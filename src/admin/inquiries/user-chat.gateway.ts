import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import type { ChatServer, ChatSocket } from '../../common/types/chat-socket';
import { AuthService } from '../../auth/auth.service';
import { AdminInquiriesService } from './admin-inquiries.service';
import { InquirySenderType } from '../../common/enums';

interface JoinRoomPayload {
  roomId?: string;
}

interface SendMessagePayload {
  roomId?: string;
  content: string;
}

interface ReadAlertPayload {
  roomId?: string;
}

@WebSocketGateway({ namespace: '/user-chat', cors: { origin: '*' } })
export class UserChatGateway {
  private readonly logger = new Logger(UserChatGateway.name);

  @WebSocketServer()
  server!: ChatServer;

  constructor(
    private readonly authService: AuthService,
    private readonly inquiriesService: AdminInquiriesService,
  ) {}

  async handleConnection(client: ChatSocket) {
    const token = this.extractToken(client);
    if (token) {
      const user = await this.authService.validateAccessToken(token);
      if (user) {
        client.data.userId = user.id;
        this.logger.log(`User connected: ${user.id}`);
        return;
      }
    }

    // 토큰 누락/만료 시 즉시 끊지 않고, 재인증 시간을 준다.
    client.data.authTimeout = setTimeout(() => {
      client.disconnect(true);
    }, 5000);
  }

  handleDisconnect(client: ChatSocket) {
    if (client.data.authTimeout) {
      clearTimeout(client.data.authTimeout);
      client.data.authTimeout = undefined;
    }
    this.logger.log(`User disconnected: ${client.id}`);
  }

  @SubscribeMessage('authenticate')
  async authenticate(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { token?: string },
  ) {
    const token = payload?.token?.trim();
    if (!token) {
      throw new WsException('토큰이 필요합니다.');
    }

    const user = await this.authService.validateAccessToken(token);
    if (!user) {
      throw new WsException('유저 인증이 필요합니다.');
    }

    if (client.data.authTimeout) {
      clearTimeout(client.data.authTimeout);
      client.data.authTimeout = undefined;
    }

    client.data.userId = user.id;
    this.logger.log(`User authenticated: ${user.id}`);
    return { success: true };
  }

  @SubscribeMessage('join_room')
  async joinRoom(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException('유저 인증이 필요합니다.');
    }

    const requestedRoomId = payload?.roomId?.trim();
    const inquiry = requestedRoomId
      ? await this.ensureUserRoom(userId, requestedRoomId)
      : await this.inquiriesService.getOrCreateRoomForUser(userId);

    const roomName = this.roomName(inquiry.id);
    await client.join(roomName);
    client.data.roomId = inquiry.id;

    return { success: true, roomId: inquiry.id };
  }

  @SubscribeMessage('leave_room')
  async leaveRoom(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    const roomId = payload?.roomId ?? client.data.roomId;
    if (!roomId) {
      throw new WsException('roomId가 필요합니다.');
    }
    await client.leave(this.roomName(roomId));
    return { success: true };
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException('유저 인증이 필요합니다.');
    }

    const roomId = payload?.roomId ?? client.data.roomId;
    if (!roomId || !payload?.content?.trim()) {
      throw new WsException('roomId와 content가 필요합니다.');
    }

    await this.ensureUserRoom(userId, roomId);
    const message = await this.inquiriesService.createMessage({
      inquiryId: roomId,
      senderType: InquirySenderType.USER,
      senderUserId: userId,
      content: payload.content,
    });

    const roomName = this.roomName(roomId);
    const eventPayload = {
      id: message.id,
      roomId,
      senderType: message.senderType,
      senderUserId: message.senderUserId,
      content: message.content,
      createdAt: message.createdAt,
    };

    this.server.to(roomName).emit('receive_message', eventPayload);
    this.getRootServer()
      .of('/admin-chat')
      .to(roomName)
      .emit('receive_message', eventPayload);

    return { success: true, messageId: message.id };
  }

  @SubscribeMessage('read_alert')
  async readAlert(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: ReadAlertPayload,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException('유저 인증이 필요합니다.');
    }

    const roomId = payload?.roomId ?? client.data.roomId;
    if (!roomId) {
      throw new WsException('roomId가 필요합니다.');
    }

    await this.ensureUserRoom(userId, roomId);
    await this.inquiriesService.markRead(roomId, InquirySenderType.USER);

    const roomName = this.roomName(roomId);
    const eventPayload = {
      roomId,
      reader: InquirySenderType.USER,
    };

    this.server.to(roomName).emit('read_alert', eventPayload);
    this.getRootServer()
      .of('/admin-chat')
      .to(roomName)
      .emit('read_alert', eventPayload);

    return { success: true };
  }

  private extractToken(client: ChatSocket) {
    const authToken = client.handshake.auth?.token;
    if (authToken) {
      return authToken;
    }

    const header = client.handshake.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.replace('Bearer ', '');
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string') {
      return queryToken;
    }

    return null;
  }

  private roomName(roomId: string) {
    return `inquiry:${roomId}`;
  }

  private getRootServer() {
    const server = this.server as unknown as { server?: ChatServer };
    return server.server ?? this.server;
  }

  private async ensureUserRoom(userId: string, roomId: string) {
    const inquiry = await this.inquiriesService.getRoomById(roomId);
    if (inquiry.userId !== userId) {
      throw new WsException('접근 권한이 없습니다.');
    }
    return inquiry;
  }
}

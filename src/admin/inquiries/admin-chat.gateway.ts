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
import { AdminAuthService } from '../auth/admin-auth.service';
import { AdminInquiriesService } from './admin-inquiries.service';
import { InquirySenderType } from '../../common/enums';

interface JoinRoomPayload {
  roomId: string;
}

interface SendMessagePayload {
  roomId: string;
  content: string;
}

interface ReadAlertPayload {
  roomId: string;
}

@WebSocketGateway({ namespace: '/admin-chat', cors: { origin: '*' } })
export class AdminChatGateway {
  private readonly logger = new Logger(AdminChatGateway.name);

  @WebSocketServer()
  server!: ChatServer;

  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly inquiriesService: AdminInquiriesService,
  ) {}

  async handleConnection(client: ChatSocket) {
    const token = this.extractToken(client);
    if (token) {
      const admin = await this.adminAuthService.validateAccessToken(token);
      if (admin) {
        client.data.adminId = admin.id;
        this.logger.log(`Admin connected: ${admin.email}`);
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
    this.logger.log(`Admin disconnected: ${client.id}`);
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

    const admin = await this.adminAuthService.validateAccessToken(token);
    if (!admin) {
      throw new WsException('관리자 인증이 필요합니다.');
    }

    if (client.data.authTimeout) {
      clearTimeout(client.data.authTimeout);
      client.data.authTimeout = undefined;
    }

    client.data.adminId = admin.id;
    this.logger.log(`Admin authenticated: ${admin.email}`);
    return { success: true };
  }

  @SubscribeMessage('join_room')
  async joinRoom(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (!payload?.roomId) {
      throw new WsException('roomId가 필요합니다.');
    }

    await this.inquiriesService.getRoomById(payload.roomId);
    const roomName = this.roomName(payload.roomId);
    await client.join(roomName);

    return { success: true, roomId: payload.roomId };
  }

  @SubscribeMessage('leave_room')
  async leaveRoom(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    if (!payload?.roomId) {
      throw new WsException('roomId가 필요합니다.');
    }
    await client.leave(this.roomName(payload.roomId));
    return { success: true };
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    if (!payload?.roomId || !payload?.content?.trim()) {
      throw new WsException('roomId와 content가 필요합니다.');
    }

    const adminId = client.data.adminId;
    if (!adminId) {
      throw new WsException('관리자 인증이 필요합니다.');
    }

    const message = await this.inquiriesService.createMessage({
      inquiryId: payload.roomId,
      senderType: InquirySenderType.ADMIN,
      senderAdminId: adminId,
      content: payload.content,
    });

    const roomName = this.roomName(payload.roomId);
    const eventPayload = {
      id: message.id,
      roomId: payload.roomId,
      senderType: message.senderType,
      senderAdminId: message.senderAdminId,
      content: message.content,
      createdAt: message.createdAt,
    };

    this.server.to(roomName).emit('receive_message', eventPayload);
    this.getRootServer()
      .of('/user-chat')
      .to(roomName)
      .emit('receive_message', eventPayload);

    return { success: true, messageId: message.id };
  }

  @SubscribeMessage('read_alert')
  async readAlert(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: ReadAlertPayload,
  ) {
    if (!payload?.roomId) {
      throw new WsException('roomId가 필요합니다.');
    }

    const adminId = client.data.adminId;
    if (!adminId) {
      throw new WsException('관리자 인증이 필요합니다.');
    }

    await this.inquiriesService.markRead(
      payload.roomId,
      InquirySenderType.ADMIN,
    );

    const roomName = this.roomName(payload.roomId);
    const eventPayload = {
      roomId: payload.roomId,
      reader: InquirySenderType.ADMIN,
    };
    this.server.to(roomName).emit('read_alert', eventPayload);
    this.getRootServer()
      .of('/user-chat')
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
}

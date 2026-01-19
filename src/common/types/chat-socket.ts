export interface ChatSocketData {
  adminId?: string;
  userId?: string;
  roomId?: string;
}

export interface ChatHandshake {
  auth?: {
    token?: string;
  };
  headers?: {
    authorization?: string;
  };
  query?: {
    token?: string;
  };
}

export interface ChatSocket {
  id: string;
  data: ChatSocketData;
  handshake: ChatHandshake;
  join(room: string): Promise<void> | void;
  leave(room: string): Promise<void> | void;
  disconnect(close?: boolean): void;
}

export interface ChatEmitter {
  to(room: string): ChatEmitter;
  emit(event: string, payload: unknown): boolean;
}

export interface ChatServer extends ChatEmitter {
  of(namespace: string): ChatEmitter;
}

# 문의 채팅(Socket) 연동 가이드

대상: Next.js / React Native 프론트엔드 개발자  
기능: 유저 문의하기 + 어드민 문의하기 실시간 채팅

## 개요

- 실시간 메시지 전송/수신은 WebSocket(Socket.IO)로 처리합니다.
- 목록/이력 조회는 HTTP API로 처리합니다.
- 네임스페이스는 유저/어드민으로 분리되어 있습니다.

### 네임스페이스

- 유저: `/user-chat`
- 어드민: `/admin-chat`

### 인증 방식 (3가지 중 1개 택1)

- `auth: { token }`
- `Authorization: Bearer <token>` 헤더
- `query: { token }`

## 공통 이벤트

| 이벤트 | 방향 | 설명 |
|---|---|---|
| `authenticate` | client → server | 재인증(토큰 갱신) |
| `join_room` | client → server | 방 입장 |
| `leave_room` | client → server | 방 나가기 |
| `send_message` | client → server | 메시지 전송 |
| `receive_message` | server → client | 메시지 수신 |
| `read_alert` | 양방향 | 읽음 처리 알림 |

## 유저 문의하기 흐름 (Next/RN)

### 1) HTTP로 문의 목록/이력 조회

- `GET /api/me/inquiries?limit=20&offset=0`  
  - 내 문의(채팅방) 목록 조회
- `GET /api/me/inquiries/:id?limit=20&offset=0`  
  - 내 문의 상세(메시지) 조회

### 2) Socket 연결 (유저)

```
io(`${API_BASE_URL}/user-chat`, {
  auth: { token: userAccessToken },
  transports: ['websocket'],
});
```

### 2-1) 토큰 누락/만료 시 재인증

- 소켓 연결 시 토큰이 없거나 만료되면 5초 유예 후 연결이 종료됩니다.
- 유예 시간 내에 `authenticate` 이벤트로 토큰을 다시 보내면 정상 인증됩니다.

```
socket.emit('authenticate', { token: userAccessToken }, (res) => {
  // res: { success: true }
});
```

### 2-2) 재로그인 직후 권장 흐름 (유저)

```
// 1) 소켓 연결 (토큰 없거나 갱신 직후)
const socket = io(`${API_BASE_URL}/user-chat`, { transports: ['websocket'] });

// 2) 토큰 재인증 (5초 유예 내)
socket.emit('authenticate', { token: userAccessToken }, (res) => {
  if (!res?.success) return;

  // 3) 방 입장
  socket.emit('join_room', {}, (joinRes) => {
    const { roomId } = joinRes;
    // 4) 메시지 전송
    socket.emit('send_message', { roomId, content: '문의 내용' });
  });
});
```

### 3) 방 입장 (roomId 없이 호출 가능)

- `join_room`에 `roomId`가 없으면 서버가 자동으로 문의방을 생성/조회합니다.
- 응답으로 `roomId`를 받습니다.

```
socket.emit('join_room', {}, (res) => {
  const { roomId } = res;
});
```

### 4) 메시지 전송/수신

```
socket.emit('send_message', { roomId, content: '문의 내용' });

socket.on('receive_message', (payload) => {
  // payload: { id, roomId, senderType, senderUserId?, senderAdminId?, content, createdAt }
});
```

### 5) 읽음 처리

```
socket.emit('read_alert', { roomId });

socket.on('read_alert', (payload) => {
  // payload: { roomId, reader: 'USER' | 'ADMIN' }
});
```

## 어드민 문의하기 흐름 (Admin UI)

### 1) HTTP로 문의 목록/이력 조회

- `GET /api/admin/inquiries?status=PENDING&limit=20&offset=0`
- `GET /api/admin/inquiries/:id?limit=20&offset=0`

### 2) Socket 연결 (어드민)

```
io(`${API_BASE_URL}/admin-chat`, {
  auth: { token: adminAccessToken },
  transports: ['websocket'],
});
```

### 2-1) 토큰 누락/만료 시 재인증

- 소켓 연결 시 토큰이 없거나 만료되면 5초 유예 후 연결이 종료됩니다.
- 유예 시간 내에 `authenticate` 이벤트로 토큰을 다시 보내면 정상 인증됩니다.

```
adminSocket.emit('authenticate', { token: adminAccessToken }, (res) => {
  // res: { success: true }
});
```

### 2-2) 재로그인 직후 권장 흐름 (어드민)

```
// 1) 소켓 연결 (토큰 없거나 갱신 직후)
const adminSocket = io(`${API_BASE_URL}/admin-chat`, { transports: ['websocket'] });

// 2) 토큰 재인증 (5초 유예 내)
adminSocket.emit('authenticate', { token: adminAccessToken }, (res) => {
  if (!res?.success) return;

  // 3) 방 입장 (roomId 필수)
  adminSocket.emit('join_room', { roomId }, () => {
    // 4) 메시지 전송
    adminSocket.emit('send_message', { roomId, content: '답변 내용' });
  });
});
```

### 3) 방 입장 (roomId 필수)

```
adminSocket.emit('join_room', { roomId }, (res) => {
  // res: { success: true, roomId }
});
```

### 4) 메시지 전송/수신

```
adminSocket.emit('send_message', { roomId, content: '답변 내용' });

adminSocket.on('receive_message', (payload) => {
  // payload: { id, roomId, senderType, senderUserId?, senderAdminId?, content, createdAt }
});
```

### 5) 읽음 처리

```
adminSocket.emit('read_alert', { roomId });
adminSocket.on('read_alert', (payload) => {
  // payload: { roomId, reader: 'USER' | 'ADMIN' }
});
```

## 페이로드 요약

### authenticate (client → server)

```json
{ "token": "accessToken" }
```

### join_room (client → server)

```json
{ "roomId": "uuid" }
```

### send_message (client → server)

```json
{ "roomId": "uuid", "content": "string" }
```

### receive_message (server → client)

```json
{
  "id": "uuid",
  "roomId": "uuid",
  "senderType": "USER | ADMIN",
  "senderUserId": "uuid | null",
  "senderAdminId": "uuid | null",
  "content": "string",
  "createdAt": "ISO8601"
}
```

### read_alert (양방향)

```json
{
  "roomId": "uuid",
  "reader": "USER | ADMIN"
}
```

## 참고 사항

- 유저는 `join_room`에서 `roomId`를 생략해도 됩니다.
- 어드민은 반드시 `roomId`를 전달해야 합니다.
- 메시지는 DB 저장 후 브로드캐스트됩니다.
- 목록/이력은 HTTP로 먼저 가져오고, 실시간은 Socket으로 동기화하는 방식이 안정적입니다.
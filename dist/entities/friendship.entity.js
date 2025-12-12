"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Friendship = void 0;
const typeorm_1 = require("typeorm");
const enums_1 = require("../common/enums");
const user_entity_1 = require("./user.entity");
let Friendship = class Friendship {
    id;
    userId;
    friendId;
    status;
    createdAt;
    updatedAt;
    user;
    friend;
};
exports.Friendship = Friendship;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Friendship.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'user_id', comment: '요청자' }),
    __metadata("design:type", String)
], Friendship.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'friend_id', comment: '대상자' }),
    __metadata("design:type", String)
], Friendship.prototype, "friendId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: enums_1.FriendStatus,
        default: enums_1.FriendStatus.PENDING,
        comment: '현재 관계 상태',
    }),
    __metadata("design:type", String)
], Friendship.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Friendship.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        name: 'updated_at',
        nullable: true,
        comment: '상태 변경(수락/차단) 일시',
    }),
    __metadata("design:type", Date)
], Friendship.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.friendships, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], Friendship.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.friendOf, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'friend_id' }),
    __metadata("design:type", user_entity_1.User)
], Friendship.prototype, "friend", void 0);
exports.Friendship = Friendship = __decorate([
    (0, typeorm_1.Entity)('friendships'),
    (0, typeorm_1.Unique)(['userId', 'friendId'])
], Friendship);
//# sourceMappingURL=friendship.entity.js.map
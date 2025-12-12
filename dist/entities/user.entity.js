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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const capsule_entity_1 = require("./capsule.entity");
const order_entity_1 = require("./order.entity");
const friendship_entity_1 = require("./friendship.entity");
const capsule_access_log_entity_1 = require("./capsule-access-log.entity");
const customer_service_entity_1 = require("./customer-service.entity");
let User = class User {
    id;
    nickname;
    phoneNumber;
    email;
    profileImg;
    kakaoId;
    isMarketingAgreed;
    isPushAgreed;
    isLocationTermAgreed;
    isActive;
    createdAt;
    updatedAt;
    deletedAt;
    capsules;
    orders;
    friendships;
    friendOf;
    accessLogs;
    customerServices;
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid', {
        comment: '외부 유출 방지를 위한 랜덤 고유 ID',
    }),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, comment: '앱 내 표시되는 이름' }),
    __metadata("design:type", String)
], User.prototype, "nickname", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        unique: true,
        name: 'phone_number',
        comment: '친구 추천 및 중복 가입 방지',
    }),
    __metadata("design:type", String)
], User.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        nullable: true,
        comment: '계정 복구 및 알림용',
    }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 500,
        nullable: true,
        name: 'profile_img',
        comment: 'S3 이미지 URL',
    }),
    __metadata("design:type", String)
], User.prototype, "profileImg", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 100,
        nullable: true,
        name: 'kakao_id',
        unique: true,
        comment: '카카오 소셜로그인 ID',
    }),
    __metadata("design:type", String)
], User.prototype, "kakaoId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'boolean',
        default: false,
        name: 'is_marketing_agreed',
        comment: '마케팅 정보 수신 동의',
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isMarketingAgreed", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'boolean',
        default: true,
        name: 'is_push_agreed',
        comment: '앱 푸시 알림 수신 동의',
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isPushAgreed", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'boolean',
        default: false,
        name: 'is_location_term_agreed',
        comment: '위치기반 서비스 이용약관 동의',
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isLocationTermAgreed", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'boolean',
        default: true,
        name: 'is_active',
        comment: 'True: 활동중, False: 탈퇴/정지',
    }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({
        name: 'deleted_at',
        nullable: true,
        comment: 'Soft Delete',
    }),
    __metadata("design:type", Date)
], User.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => capsule_entity_1.Capsule, (capsule) => capsule.user),
    __metadata("design:type", Array)
], User.prototype, "capsules", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => order_entity_1.Order, (order) => order.user),
    __metadata("design:type", Array)
], User.prototype, "orders", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => friendship_entity_1.Friendship, (friendship) => friendship.user),
    __metadata("design:type", Array)
], User.prototype, "friendships", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => friendship_entity_1.Friendship, (friendship) => friendship.friend),
    __metadata("design:type", Array)
], User.prototype, "friendOf", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => capsule_access_log_entity_1.CapsuleAccessLog, (log) => log.viewer),
    __metadata("design:type", Array)
], User.prototype, "accessLogs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => customer_service_entity_1.CustomerService, (cs) => cs.user),
    __metadata("design:type", Array)
], User.prototype, "customerServices", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users')
], User);
//# sourceMappingURL=user.entity.js.map
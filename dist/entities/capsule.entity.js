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
exports.Capsule = void 0;
const typeorm_1 = require("typeorm");
const enums_1 = require("../common/enums");
const user_entity_1 = require("./user.entity");
const product_entity_1 = require("./product.entity");
const capsule_access_log_entity_1 = require("./capsule-access-log.entity");
let Capsule = class Capsule {
    id;
    userId;
    productId;
    latitude;
    longitude;
    title;
    content;
    mediaUrl;
    mediaType;
    openAt;
    isLocked;
    viewLimit;
    viewCount;
    createdAt;
    deletedAt;
    user;
    product;
    accessLogs;
};
exports.Capsule = Capsule;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Capsule.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'user_id', comment: '작성자(Owner)' }),
    __metadata("design:type", String)
], Capsule.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'uuid',
        name: 'product_id',
        nullable: true,
        comment: '유료 스킨/기능 사용 시 연결, 무료면 NULL',
    }),
    __metadata("design:type", String)
], Capsule.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 10,
        scale: 8,
        nullable: true,
        comment: '위도: 소수점 8자리로 cm 단위 정밀도 보장',
    }),
    __metadata("design:type", Number)
], Capsule.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'decimal',
        precision: 11,
        scale: 8,
        nullable: true,
        comment: '경도: 소수점 8자리로 cm 단위 정밀도 보장',
    }),
    __metadata("design:type", Number)
], Capsule.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], Capsule.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'text',
        nullable: true,
        comment: '사용자가 작성한 메시지',
    }),
    __metadata("design:type", String)
], Capsule.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 500,
        nullable: true,
        name: 'media_url',
        comment: '업로드된 파일의 CDN/S3 경로',
    }),
    __metadata("design:type", String)
], Capsule.prototype, "mediaUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: enums_1.MediaType,
        default: enums_1.MediaType.TEXT,
        name: 'media_type',
        comment: '저장된 미디어의 종류',
    }),
    __metadata("design:type", String)
], Capsule.prototype, "mediaType", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'timestamp',
        nullable: true,
        name: 'open_at',
        comment: '개봉 예정일. 이 시간이 지나야 is_locked 해제 가능',
    }),
    __metadata("design:type", Date)
], Capsule.prototype, "openAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'boolean',
        default: true,
        name: 'is_locked',
        comment: 'App 표시용 플래그. open_at 비교 후 서버에서 업데이트',
    }),
    __metadata("design:type", Boolean)
], Capsule.prototype, "isLocked", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: 0,
        name: 'view_limit',
        comment: '선착순 인원 제한 (이스터에그용). 0이면 무제한',
    }),
    __metadata("design:type", Number)
], Capsule.prototype, "viewLimit", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'int',
        default: 0,
        name: 'view_count',
        comment: '현재까지 열람한 인원 수. view_limit 도달 시 마감',
    }),
    __metadata("design:type", Number)
], Capsule.prototype, "viewCount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Capsule.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({
        name: 'deleted_at',
        nullable: true,
        comment: '사용자가 삭제했거나, 선착순 마감되어 지도에서 사라진 시점',
    }),
    __metadata("design:type", Date)
], Capsule.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.capsules, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], Capsule.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => product_entity_1.Product, (product) => product.capsules, {
        onDelete: 'SET NULL',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'product_id' }),
    __metadata("design:type", product_entity_1.Product)
], Capsule.prototype, "product", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => capsule_access_log_entity_1.CapsuleAccessLog, (log) => log.capsule),
    __metadata("design:type", Array)
], Capsule.prototype, "accessLogs", void 0);
exports.Capsule = Capsule = __decorate([
    (0, typeorm_1.Entity)('capsules')
], Capsule);
//# sourceMappingURL=capsule.entity.js.map
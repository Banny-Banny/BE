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
exports.CapsuleAccessLog = void 0;
const typeorm_1 = require("typeorm");
const capsule_entity_1 = require("./capsule.entity");
const user_entity_1 = require("./user.entity");
let CapsuleAccessLog = class CapsuleAccessLog {
    id;
    capsuleId;
    viewerId;
    viewedAt;
    capsule;
    viewer;
};
exports.CapsuleAccessLog = CapsuleAccessLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], CapsuleAccessLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'capsule_id' }),
    __metadata("design:type", String)
], CapsuleAccessLog.prototype, "capsuleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'viewer_id' }),
    __metadata("design:type", String)
], CapsuleAccessLog.prototype, "viewerId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'viewed_at' }),
    __metadata("design:type", Date)
], CapsuleAccessLog.prototype, "viewedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => capsule_entity_1.Capsule, (capsule) => capsule.accessLogs, {
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'capsule_id' }),
    __metadata("design:type", capsule_entity_1.Capsule)
], CapsuleAccessLog.prototype, "capsule", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.accessLogs, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'viewer_id' }),
    __metadata("design:type", user_entity_1.User)
], CapsuleAccessLog.prototype, "viewer", void 0);
exports.CapsuleAccessLog = CapsuleAccessLog = __decorate([
    (0, typeorm_1.Entity)('capsule_access_logs'),
    (0, typeorm_1.Unique)(['capsuleId', 'viewerId'])
], CapsuleAccessLog);
//# sourceMappingURL=capsule-access-log.entity.js.map
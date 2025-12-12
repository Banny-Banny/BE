"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriendStatus = exports.PaymentStatus = exports.OrderStatus = exports.MediaType = void 0;
var MediaType;
(function (MediaType) {
    MediaType["TEXT"] = "TEXT";
    MediaType["IMAGE"] = "IMAGE";
    MediaType["VIDEO"] = "VIDEO";
    MediaType["MUSIC"] = "MUSIC";
})(MediaType || (exports.MediaType = MediaType = {}));
var OrderStatus;
(function (OrderStatus) {
    OrderStatus["PENDING"] = "PENDING";
    OrderStatus["PAID"] = "PAID";
    OrderStatus["CANCELED"] = "CANCELED";
    OrderStatus["FAILED"] = "FAILED";
})(OrderStatus || (exports.OrderStatus = OrderStatus = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["READY"] = "READY";
    PaymentStatus["PAID"] = "PAID";
    PaymentStatus["CANCELED"] = "CANCELED";
    PaymentStatus["FAILED"] = "FAILED";
})(PaymentStatus || (exports.PaymentStatus = PaymentStatus = {}));
var FriendStatus;
(function (FriendStatus) {
    FriendStatus["PENDING"] = "PENDING";
    FriendStatus["CONNECTED"] = "CONNECTED";
    FriendStatus["BLOCKED"] = "BLOCKED";
})(FriendStatus || (exports.FriendStatus = FriendStatus = {}));
//# sourceMappingURL=index.js.map
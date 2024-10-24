
export const OrderTracking = {
    //order status
    STATUS_PENDING: 1,
    STATUS_PROCESSING: 2,
    STATUS_SHIPPED: 4,
    STATUS_COMPLETED: 6,
    STATUS_CANCEL: 8,
    STATUS_RETURN: 10,
    STATUS_PRE_PROCESSING: 12,
    STATUS_DELIVERED: 14,
    STATUS_PACKED: 16,
    STATUS_PICKING: 18,
    STATUS_PARTIAL_DELIVERY: 20,

    //verify
    NOT_VERIFY: 0,
    VERIFY_OK: 1,


    //shipper
    HASAKI: 1,
    SHOPEE: 3,
    LAZADA: 5,
    TIKTOK: 7,
    GIAO_HANG_NHANH: 10,
    HASAKI_NOW: 13,
    SHOPEE_EXPRESS: 16,
    NHAT_TIN_LOGISTICS: 17,
    PICK_UP: 4,
    VIETTEL_POST: 8,
    
    //Platform
    WEB: "web",
    APP: "app",

    
    RECEIPT_COMPLETE: 2,
    RECEIPT_CANCEL: 8,
}

export const OrderStatus= {
    1: "PENDING",
    2: "PROCESSING",
    4: "SHIPPED",
    6: "COMPLETED",
    8: "CANCEL",
    10: "RETURN",
    12: "RE-PROCESSING",
    14: "DELIVERED",
    16: "PACKED",
    18: "PICKING",
    20: "PARTIAL DELIVERY"
};
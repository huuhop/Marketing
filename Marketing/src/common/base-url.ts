// INSIDE
export const INSIDE_ORDER_URL = process.env.MODE === 'production' ? ''
    : (process.env.MODE === 'qc' ? '' : '')
// ECOMERCE
export const ECOMERCE_PRODUCT_NEW = process.env.MODE === 'production' ? ''
    : (process.env.MODE === 'qc' ? '' : '')
export const ECOMERCE_PROMOTIONS_URL = process.env.MODE === 'production' ? ''
    : (process.env.MODE === 'qc' ? '' : '')
export const ECOMERCE_AVAILABLE_STORE_URL = process.env.MODE === 'production' ? ''
    : (process.env.MODE === 'qc' ? '' : '')
//
export const SHOPEE_HOST = process.env.MODE === "production" ? ''
    : (process.env.MODE === 'qc' ? '' : '')
export const SHOPEE_PATH_ITEM_LIST = '/api/v2/product/get_item_list'
export const SHOPEE_PATH_BASE_INFO = '/api/v2/product/get_item_base_info'
export const SHOPEE_PATH_MODEL_LIST = '/api/v2/product/get_model_list'
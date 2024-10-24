
export const putMappingPriceInfo:any = {
    sku: {
      type: 'keyword'
    },
    item_name: {
      type: 'keyword'
    },

    item_id_tiktok: {
      type: 'keyword'
    },
    current_price_tiktok: {
      type: 'double',
    },
    original_price_tiktok: {
      type: 'double',
    },
    status_tiktok: {
      type: 'keyword'
    },
    id_activity: {
      type: 'keyword'
    },

    item_id_shopee: {
      type: 'keyword'
    },
    current_price_shopee: {
      type: 'double',
    },
    original_price_shopee: {
      type: 'double',
    },
    status_shopee: {
      type: 'keyword'
    },
    category_id: {
      type: 'integer',
    },
    model_name: {
      type: 'keyword'
    },

    item_id_lazada: {
      type: 'keyword'
    },
    current_price_lazada: {
      type: 'double',
    },
    original_price_lazada: {
      type: 'double',
    },
    status_lazada: {
      type: 'keyword'
    },
    url_lazada_key: {
      type: 'keyword'
    },
    item_id_hasaki: {
      type: 'keyword'
    },
    current_price_hasaki: {
      type: 'double',
    },
    original_price_hasaki: {
      type: 'double',
    },
    status_hasaki: {
      type: 'keyword'
    },

    url_key: {
      type: 'keyword'
    },
    is_best_eller: {
      type: 'boolean',
    },
    brand: {
      type: 'keyword',
    },
    product_type: {
      type: 'byte'
    },
};

export const putMappingAnalyticsInfo:any = {
    index: {
      type: 'long'
    },
    itemId: {
      type: 'keyword'
    },
    date: {
      type: 'keyword'
    },
    itemName: {
      type: 'keyword',
    },
    channel: {
      type: 'keyword',
    },
    channelFlag: {
      type: 'keyword',
    },
    deviceCategory: {
      type: 'keyword'
    },
    city: {
      type: 'keyword'
    },
    sessionSourceMedium: {
      type: 'keyword'
    },
    firstUserCampaignName: {
      type: 'keyword'
    },
    itemCategory: {
      type: 'keyword'
    },
    itemCategory2: {
      type: 'keyword',
    },
    itemCategory3: {
      type: 'keyword',
    },
    itemBrand: {
      type: 'keyword',
    },
    vendor: {
      type: 'keyword',
    },
    manufacture: {
      type: 'keyword',
    },
    itemsViewed: {
      type: 'long',
    },
    itemsAddedToCart: {
      type: 'long',
    },
    itemsCheckedOut: {
      type: 'long',
    },
    itemsPurchased: {
      type: 'long',
    },
    itemRevenue: {
      type: 'long',
    },
    itemsPurchasedInside: {
      type: 'long',
    },
    itemRevenueInside: {
      type: 'long',
    },
    itemCreatedAt: {
      type: "keyword",
    },
    itemCompletedDate: {
      type: "keyword",
    },
    itemProductType: {
      type: "keyword",
    },
    itemInStore: {
      type: "keyword",
    },
    region: {
      type: "keyword",
    },
    itemCreatedDate: {
      type: "keyword",
    },
    itemOrderId: {
      type: "keyword",
    },
    itemActiveRule: {
      type: "long",
    },
    itemGifts: {
      type: "keyword",
    },
    itemVouchers: {
      type: "keyword",
    },
    itemChannelDetail: {
      type: "keyword",
    },
    itemHasakiPrice: {
      type: "long",
    },
    orderCreateDate: {
      type: "keyword",
    },
    orderUpdateDate: {
      type: "keyword",
    },
};

export const putMappingCampaignInfo:any = {
    campaignName: {
      type: 'keyword'
    },
    campaignId: {
      type: 'keyword'
    },
    date: {
      type: 'keyword'
    },
    channel: {
      type: 'keyword',
    },
    transactionId: {
      type: 'keyword',
    },
    advertiserAdCost: {
      type: 'long',
    },
    coefficient: {
      type: 'integer',
    },
    purchases: {
      type: 'long'
    },
    totalRevenue: {
      type: 'long'
    },
    status: {
      type: 'byte'
    },
    insideCreatedDate: {
      type: 'keyword'
    }
};

export const putMappingHistoryFileInfo:any = {
    userId: {
      type: 'long'
    },
    sqlQueryString: {
      type: 'keyword'
    },
    status: {
      type: 'byte'
    },
    nameUserFile: {
      type: 'keyword',
    },
    url: {
      type: 'keyword',
    },
    pathName: {
      type: 'keyword',
    },
    typeFile: {
      type: 'keyword'
    },
    fileKey: {
      type: 'keyword'
    },
    excelPage: {
      type: 'keyword'
    },
    createAt: {
      type: 'keyword'
    },
};

export const putMappingShoppingPerformanceViewInfo:any = {
  campaign_name: {
    type: 'keyword'
  },
  campaign_id: {
    type: 'keyword'
  },
  sku: {
    type: 'keyword'
  },
  date: {
    type: 'keyword'
  },
  metric_clicks: {
    type: 'long',
  },
  metric_impressions: {
    type: 'long'
  },
  metric_costs: {
    type: 'long'
  },
  metric_cost_conversions: {
    type: 'long'
  },
  metric_conversions: {
    type: 'double',
  },
  metric_conv_values: {
    type: 'double',
  },
  purchase_inside: {
    type: 'long',
  },
  revenue_inside: {
    type: 'long',
  },
};
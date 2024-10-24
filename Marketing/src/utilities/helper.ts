import { Define } from "src/common";
import regions from "./regions.json";
import crypto  from "crypto";
import * as fs from 'fs';
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import moment from "moment";
import { pageFileName, statusFileDownload } from "src/common/commom";
import * as cryptoJs from 'crypto-js';

export const getObjectBySku = (sku: any, data: any, key: string) => {
    if (!data) {
        return null;
    }
    switch (key) {
        case 'sku':
            return data.find((item: any) => item.sku == sku);
        case 'level':
            return data.find((item: any) => item.level == sku);
        case 'city_id':
            return data.find((item: any) => item.city_id == sku);
        case 'city_name':
            return data.find((item: any) => item.city_name == sku);
        case 'key':
            return data.find((item: any) => item.key == sku);
        default:
            break;
    }
}

export const getNameCity = (inputString: string) => {
    if(!inputString){
        return "";
    }
    const words = inputString?.split("-"); // Split the string by dashes

    const convertedString = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
    .join(" "); // Join the words with a space between them

    return convertedString;
}

export const getStockInCatchByStoreID = (listCache: any, store: string) => {
    const result = listCache.filter((item: any) => {
        const stocks = item.stocks.map((stock: any) => stock.stock_id);
        return stocks.includes(store);
      });
      if(result.length > 0){
        return result[0];
      }
    return '';
}

export const getDateFormat = (date: any) => {
    return date.replace(/-/g, "");
}

export const convertGADateFormat = (dateString: string)=>{
  return dateString.slice(0, 4) + '-' + dateString.slice(4, 6) + '-' + dateString.slice(6, 8)
}

export const getTimestampGTM7FromStr = (strDate: string) => {
  // Format: 'YYYY-MM-DD HH:mm:ss';
  const date = new Date(strDate + ' GMT+0700');
  const timestamp = Math.floor(date.getTime() / 1000);
  return timestamp;
};

export const checkKeysExist = (data: any, searchTerm: string) => {
    const hasKey = data.find((obj: any) => obj.field === searchTerm);
    return hasKey? true: false;
}

export const checkKeySourceExist = (data: Array<{ [key: string]: unknown }>, requiredKey: string) => {
  const hasKey = data.some(obj =>
      obj.hasOwnProperty(requiredKey)
    );
  return hasKey;
}

export const getFieldName = (type: any) => {
    let field: string;
    switch (type) {
      case Define.Type.sku:
        field = "itemId";
        break;
      case Define.Type.location:
        field = "city";
        break;
      case Define.Type.channel:
        field = "channel";
        break;
      case Define.Type.catelv1:
        field = "itemCategory";
        break;
      case Define.Type.catelv2:
        field = "itemCategory2";
        break;
      case Define.Type.catelv3:
        field = "itemCategory3";
        break;
      case Define.Type.origin:
        field = "manufacture";
        break;
      case Define.Type.vendor:
        field = "vendor";
        break;
      case Define.Type.brand:
        field = "itemBrand";
        break;
      case Define.Type.region:
          field = "region";
          break;
      default:
        field = "itemId";
        break;
    }
  return field;
}

export const getFieldNameCampaign = (type: any) => {
  let field: string;
  switch (type) {
    case Define.Type.campaignName:
      field = "campaignName";
      break;
    case Define.Type.campaignId:
      field = "campaignId";
      break;
    case Define.Type.channel:
      field = "channel";
      break;
    default:
      field = "campaignName";
      break;
  }
return field;
}

export const getKeyInTerm = (index: number, terms: any) => {
  return terms[index].field;
}

export const getIndexOfObject = (data: any, searchTerm: string) => {
  const index = data.findIndex((x: any) => x.field ===searchTerm);
  return index;
}

export const getRegion = (city_id: number) => {
  let region: string = '';
  if (city_id) {
    for (let obj of regions) {
      if (obj.city_id == city_id) region = obj.region;
    }
  }
  return region;
}

export const checkPromotion = (listPromotion: any) => {
  let vouchers = [], gifts = [], findItem: any
  if (listPromotion) {
    listPromotion.forEach((item: any) => {
      let checkArr = [];
      const findedIndexArr = [
        { type: 'gift', value: 'bill' },
        { type: 'gift', value: 'tặng' },
        { type: 'voucher', value: 'hot' },
        { type: 'voucher', value: 'voucher' },
      ].map((subItem) => {
        const findedIndex = item.name.toLowerCase().indexOf(subItem.value);
        return { ...subItem, findedIndex };
      });
      let arrfilter = findedIndexArr.filter(
        (subItem) => subItem.findedIndex >= 0,
      );
      arrfilter.forEach((ele) => {
        if (ele?.findedIndex) checkArr.push(ele.findedIndex);
      });
      let minIndex = Math.min(...checkArr);
      findItem = arrfilter.find((o) => o.findedIndex == minIndex);
      if (findItem?.type === 'gift') {
        gifts.push(item);
      } else if (findItem?.type === 'voucher') {
        vouchers.push(item);
      }
    });
  }
  return { vouchers, gifts };
}

export const getTimestamp = (): number => {
  return Math.floor(Date.now() / 1000);
}

export const isTokenExpired = (credentials: any) => {
  if (!credentials || !credentials.expiry_date) {
      // If token or expiry date is not provided, consider it expired
      return true;
  }

  const expiryDate = new Date(credentials.expiry_date);
  const currentDate = new Date();

  // Check if the token has expired
  return expiryDate <= currentDate;
}

export const convertVendorAndCompanyName = (vendor: string, company: string): string => {
  let arr: string[] = []
  if (vendor ) {
    arr.push(vendor)
  }

  if (company) {
    arr.push(company)
  }

  return arr.join('-')
}

export const containsHasakiClinicAndSpa = (inputString: string) => {
  if (!inputString) {
    return false
  }
  return inputString.includes("Hasaki") && inputString.includes("Clinic") && inputString.includes("Spa");
}

export const generateUniqueString = () => {
  return crypto.randomBytes(16).toString('hex');
}

export const convertNumberArrayToStringArray = (numberArray: number[]): string[] => {
  return numberArray.map(number => number.toString());
}

export const cleanupFolders = (folderPaths: string[]): Promise<void[]> => {
  const deleteFolder = (folderPath: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      fs.rmdir(folderPath, { recursive: true }, (err) => {
        if (err) {
          console.error(`Error deleting folder ${folderPath}: ${err}`);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  };

  const deletionPromises = folderPaths.map(deleteFolder);
  return Promise.all(deletionPromises);
}

export const chunkArray = (array: any[], chunkSize: number): any[][] =>{
  const chunkedArray = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunkedArray.push(array.slice(i, i + chunkSize));
  }
  return chunkedArray;
}

export const getLast7Days = (): string[] => {
  const currentDate = new Date();
  const dates: string[] = [];

  for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(currentDate.getDate() - i);
    const dateString = date.toLocaleDateString();
    let [month, day, year] = dateString.split('/');
    if ( parseInt(month) < 10) {
      month = `0${month}`
    }
    if ( parseInt(day) < 10) {
      day = `0${day}`
    }
    const startDate = new Date(`${year}-${month}-${day}`); // Start of the current year
    const formattedDate = startDate.toISOString().split('T')[0];
    dates.push(formattedDate);
  }

  return dates;
}

export const getLastedDay = (): string => {
  const now = new Date();
  const previousDay = new Date(now);
  previousDay.setDate(now.getDate() - 1);
  const dateString = previousDay.toLocaleDateString();
  let [month, day, year] = dateString.split('/');
  if ( parseInt(month) < 10) {
    month = `0${month}`
  }
  if ( parseInt(day) < 10) {
    day = `0${day}`
  }
  const startDate = new Date(`${year}-${month}-${day}`); // Start of the current year
  const lastedDate = startDate.toISOString().split('T')[0];
  return lastedDate;
}

export const getYesterdayTimestamps = () => {
  const now = new Date();
  const previousDay = new Date(now);
  previousDay.setDate(now.getDate() - 1);
  previousDay.setHours(0, 0, 0, 0);

  const startTimeStamp: number = Math.floor(previousDay.getTime() / 1000);
  const endTimeStamp: number = startTimeStamp + (24*60*60)
  return {
    startTimeStamp,
    endTimeStamp
  };
}

export const checkIdInArrayExists = (array: any[], property: string, id: string): boolean => {
  return array.some((product: any) => product[property] === id);
}

export const findLowestPriceForId = (skuPromotion: any[], targetId: string) => {
  const filteredItems = skuPromotion.filter(item => item.id === targetId);
  if (filteredItems.length === 0) {
      return []; // or handle it as needed if no items found
  }
  return filteredItems;
}

export const chunkAndExecPromiseAll = async ({
  chunkSize,
  array,
}: {
  chunkSize: number;
  array: Promise<any>[];
}) => {
  const promiseResults = [];
  const chunks = chunkArray(array, chunkSize);
  console.log('chunks length', chunks.length);
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(chunk);
    promiseResults.push(...chunkResults);
  }
  return promiseResults;
};

export const mergeArrays = (
  arrayA: any[], 
  arrayB: any[], 
  fields: string[], 
  channel: string
) => {
  if (arrayA && arrayA.length === 0) return arrayB;
  const shouldUpdate = (key: string, isTiktok: boolean) => {
    return isTiktok ? !fields.includes(key) : fields.includes(key);
  };
  const isTiktok = channel === Define.Channel.tiktok;
  return arrayA.map(itemA => {
    const matchingItemB = arrayB.find(itemB => itemB.sku === itemA.sku);
    return matchingItemB
      ? {
          ...itemA,
          ...Object.fromEntries(
            Object.entries(matchingItemB).map(([key, value]) => [
              key,
              shouldUpdate(key, isTiktok) ? value : itemA[key] // Update logic based on channel and fields
            ])
          ),
        }
      : itemA;
  });
};

export const createPlatformData = (platform: string, defaults:any = {}) => {
  const platformData = {
    [Define.Channel.tiktok]: {
      item_id_tiktok: defaults?.itemIdTiktok || '',
      current_price_tiktok: defaults?.currentPriceTiktok != null && !isNaN(Number(defaults.currentPriceTiktok)) ? Number(defaults.currentPriceTiktok) : -1,
      original_price_tiktok: defaults?.originalPriceTiktok != null && !isNaN(Number(defaults.originalPriceTiktok)) ? Number(defaults.originalPriceTiktok) : -1,
      status_tiktok: defaults?.statusTiktok || '',
      id_activity: defaults?.idActivity || '',
    },
    [Define.Channel.shopee]: {
      item_id_shopee: defaults?.itemIdShopee || '',
      current_price_shopee: defaults?.currentPriceShopee != null ? Number(defaults.currentPriceShopee) : -1,
      original_price_shopee: defaults?.originalPriceShopee != null ? Number(defaults.originalPriceShopee) : -1,
      status_shopee: defaults?.statusShopee || '',
      category_id: defaults?.categoryId || '',
      model_name: defaults?.modelName || '',
    },
    [Define.Channel.lazada]: {
      item_id_lazada: defaults?.itemIdLazada || '',
      current_price_lazada: defaults?.currentPriceLazada != null ? Number(defaults.currentPriceLazada) : -1,
      original_price_lazada: defaults?.originalPriceLazada != null ? Number(defaults.originalPriceLazada) : -1,
      status_lazada: defaults?.statusLazada || '',
      url_lazada_key: defaults?.urlLazadaKey || '',
    },
    [Define.Channel.hasaki]: {
      item_id_hasaki: defaults?.itemIdHasaki || '',
      current_price_hasaki: defaults?.currentPriceHasaki != null ? Number(defaults.currentPriceHasaki) : -1,
      original_price_hasaki: defaults?.originalPriceHasaki != null ? Number(defaults.originalPriceHasaki) : -1,
      status_hasaki: defaults?.statusHasaki || '',
      url_key: defaults?.urlKey || '',
    },
  };

  return platformData[platform] || {};
};

//format YYYY-MM-DD HH:mm:ss
export const getDateNow = () => {
  return moment().format('YYYY-MM-DD HH:mm:ss')
}

export const axiosRequest = async (url: string, config: AxiosRequestConfig, method: 'GET' | 'POST' = 'GET'): Promise<any> => {
  try {
    const response: AxiosResponse<any> = await axios({
      method,
      url: url,
      params: config?.params,
      headers: config?.headers,
      data: config?.data ?? '', // for POST/PUT requests
    });

    return response?.data;
  } catch (error: any) {
    console.log("Time Log :", getDateNow());
    console.log("Fetch Data Error :", error);
    if (error?.response) {
      const cleanedError = {
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        dataErrors: error?.response?.data,
        headers: error?.response?.headers,
        config: error?.response?.config,
      };
      console.log("CleanedError :", cleanedError);
      throw cleanedError; // Throw cleaned error for better handling
    } else {
      throw error;
    }
  }
};

export const sortKeysOfObject = (obj: Record<string, any>) => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeysOfObject);
  }

  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortKeysOfObject(obj[key]);
      return acc;
    }, {});
}

export const formatNumber = (number: number, show_unit?: string) => {
  if (number === null || number === undefined || isNaN(number)) {
    return 'N/A';
  }

  let unit = show_unit ? ' ' + show_unit : '';
  let value = number + '';
  value = value.replace(/,/g, '');
  const reg = /^-?[0-9,]*(\.[0-9]*)?$/;
  if (reg.test(value)) {
    const list = value.split('.');
    const prefix = list[0].charAt(0) === '-' ? '-' : '';
    let num = prefix ? list[0].slice(1) : list[0];
    let result = '';
    while (num.length > 3) {
      result = `,${num.slice(-3)}${result}`;
      num = num.slice(0, num.length - 3);
    }
    if (num) {
      result = num + result;
    }
    return `${prefix}${result}${list[1] ? `.${list[1]}` : ''}${unit}`;
  }

  return number || '';
};

export const getObjectExcel = (query: any, endPoindIO: string, bucketIO: string) => {
  const pageName:string = pageFileName.checkPrice;
  const filter: any = query.filter;
  const sqlQueryParams: any = {
    perPage: query.perPage,
    filter: filter
  }
  const timestamp = getTimestamp();
  const fileKeyObj: any = {
    perPage: query.perPage,
    filter: filter,
    createAt: timestamp,
    userId: query.userId,
    nameUserFile: query.nameUserFile,
  }
  const jsonString = JSON.stringify(sqlQueryParams);
  const fileKey = JSON.stringify(fileKeyObj);
  const hashedString:string = cryptoJs.SHA256(jsonString).toString();
  query.nameFileFolder = hashedString;
  query.folderZipPath = `Export/Zip/${pageName}/`;
  query.typeFile = '.zip';
  const sqlQueryString:string = jsonString;
  const url = endPoindIO + bucketIO + '/' + query.folderZipPath + hashedString + query.typeFile;
  const pathName: string = query.folderZipPath + hashedString + query.typeFile;
  const status: number = statusFileDownload.processing;
  const data: any = {
    userId: query.userId,
    sqlQueryString: sqlQueryString,
    status: status,
    nameUserFile: query.nameUserFile,
    url: url,
    pathName: pathName,
    typeFile: query.typeFile,
    fileKey: fileKey,
    excelPage: query.excelPage,
    createAt: timestamp,
  };
  return data
}

export const createTemporaryFile = (folderExcelPath: string, folderZipPath?: string) => {
  fs.mkdir(folderExcelPath, { recursive: true }, (err) => {
    if (err) {
      console.error('Error creating folder Excel:', err);
      throw new Error(`Error creating folder Excel: ${err}`);
    }
  });
  fs.mkdir(folderZipPath, { recursive: true }, (err) => {
    if (err) {
      console.error('Error creating folder Zip:', err);
      throw new Error(`Error creating folder Zip: ${err}`);
    }
  });
  return;
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getProtocol = () => {
  if (process.env.MODE === 'production' || process.env.MODE === 'qc') {
    return 'https';
  } 
  return 'http'
};
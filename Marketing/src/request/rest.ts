export default class Rest {
    //200
    RestSuccess(data?: any) {
        return {
            "status": 1,
            "data": data
        }
    }

    RestBadRequest(msg?: any, status = 0) {
        return {
            "status": status,
            //"message: msg,
            "data": {
                "statusCode": 400,
                "name": 'BadRequestError',
                "message": msg
            }
        }
    }


    //404
    RestNotFound(msg?: any) {
        return {
            "status": 0,
            "message": msg,
            "data": {
                "statusCode": 404,
                "name": 'NotFoundError',
                "message": msg
            }
        }
    }


    //500
    RestServerError(msg?: any) {
        return {
            "status": 0,
            // message: msg,
            "data": {
                "statusCode": 500,
                "name": 'ServerError',
                "message": msg
            }
        }
    }
}
import config from '../store/config'
import requestHandler from './requestHandler'
import cacheManager from './cacheManager'
import durationReporter from './durationReporter'
import sessionManager from './sessionManager'
import { IRequestOption, IUploadFileOption, IAnyObject } from "../interface";
import jsonSuperset from '../util/jsonSuperset'

function responseForRequest(
    res: WechatMiniprogram.RequestSuccessCallbackResult,
    obj: IRequestOption
): any {
    if (res.statusCode === 200) {

        durationReporter.end(obj);
        
        // 请求格式为json，但返回了string，说明内容中可能存在导致使得JavaScript异常的字符
        if (obj.dataType === 'json' && typeof res.data === 'string') {
            res.data = jsonSuperset(res.data);
            try {
                res.data = JSON.parse(res.data);
            } catch (e) {
                throw { type: 'logic-error', res }
            }
        }

        // 当前需要重新登录
        const needReLogin = !config.isLoginTriggerByStatusCode && config.loginTrigger!(res.data);

        if (needReLogin && (obj.reLoginCount !== undefined && obj.reLoginCount < config.reLoginLimit!)) {
            // 登录态失效，且重试次数不超过配置
            sessionManager.delSession();
            return requestHandler.request(obj);
        } else if (config.successTrigger(res.data)) {
            // 接口返回成功码
            let realData: string | IAnyObject | ArrayBuffer = "";
            try {
                if (typeof config.successData === 'function') {
                    realData = config.successData(res.data);
                } else {
                    realData = res.data;
                }
            } catch (e) {}
            // 缓存存储
            cacheManager.set(obj, realData);
            if (!obj.noCacheFlash) {
                // 如果为了保证页面不闪烁，则不回调，只是缓存最新数据，待下次进入再用
                if (typeof obj.success === "function") {
                    obj.success(realData);
                } else {
                    return realData;
                }
            }
        } else {
            // 接口返回失败码
            throw { type: 'logic-error', res }
        }
    } else {
        const needReLogin = config.isLoginTriggerByStatusCode && config.loginTrigger!('' + res.statusCode);
        if (needReLogin && (obj.reLoginCount !== undefined && obj.reLoginCount < config.reLoginLimit!)) {
            sessionManager.delSession();
            return requestHandler.request(obj);
        }
        // https返回状态码非200
        throw { type: 'http-error', res }
    }
}

function responseForUploadFile(
    res: WechatMiniprogram.UploadFileSuccessCallbackResult,
    obj: IUploadFileOption
): any {
    if (res.statusCode === 200) {

        durationReporter.end(obj);

        // 内容中可能存在导致使得JavaScript异常的字符
        if (typeof res.data === 'string') {
            res.data = jsonSuperset(res.data);
            try {
                res.data = JSON.parse(res.data);
            } catch (e) {
                throw { type: 'logic-error', res }
            }
        }

        // 当前需要重新登录
        const needReLogin = !config.isLoginTriggerByStatusCode && config.loginTrigger!(res.data);

        if (needReLogin && obj.reLoginCount !== undefined && obj.reLoginCount < config.reLoginLimit!) {
            // 登录态失效，且重试次数不超过配置
            sessionManager.delSession();
            return requestHandler.uploadFile(obj);
        } else if (config.successTrigger(res.data)) {
            // 接口返回成功码
            let realData: string | IAnyObject | ArrayBuffer = "";
            try {
                if (typeof config.successData === 'function') {
                    realData = config.successData(res.data);
                } else {
                    realData = res.data;
                }
            } catch (e) {}

            if (typeof obj.success === "function") {
                obj.success(realData);
            } else {
                return realData;
            }
        } else {
            // 接口返回失败码
            throw { type: 'logic-error', res }
        }
    } else {
        const needReLogin = config.isLoginTriggerByStatusCode && config.loginTrigger!('' + res.statusCode);
        if (needReLogin && (obj.reLoginCount !== undefined && obj.reLoginCount < config.reLoginLimit!)) {
            // 登录态失效，且重试次数不超过配置
            sessionManager.delSession();
            return requestHandler.uploadFile(obj);
        }
        // https返回状态码非200
        throw { type: 'http-error', res }
    }
}

export default {
    responseForRequest,
    responseForUploadFile
};

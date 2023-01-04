import fs from 'fs';
import fetch from 'node-fetch';
import HttpsProxyAgent from 'https-proxy-agent';
import ProxyList, { IFreeProxy } from 'free-proxy';

// @ts-ignore // need to file a bug with free-proxy about needing this ts-ignore
const proxyList = new ProxyList();

let proxyCache: Array<Partial<IFreeProxy>> = [];
let proxyAllowList: Array<string> = [];
let proxyDenyList: Array<string> = [];

let lastUsedProxyIndex = 0;

export const getRandomProxy = () => {
    if (!proxyAllowList.length) {
        throw new Error('proxyAllowList is empty');
    }
    lastUsedProxyIndex = Math.floor(Math.random() * proxyAllowList.length);
    return proxyAllowList[lastUsedProxyIndex];
}

export const getNextProxy = () => {
    if (!proxyAllowList.length) {
        throw new Error('proxyAllowList is empty');
    }
    lastUsedProxyIndex = (lastUsedProxyIndex + 1) % proxyAllowList.length;
    return proxyAllowList[lastUsedProxyIndex];
}

export const updateProxyCache = async () => {
    proxyCache = await proxyList.get();
    // download https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt

    const httpTxt = await fetch('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt').then(res => res.text());
    // parse httpTxt
    const httpTxtLines = httpTxt.split('\n');
    // parse each line ip:port to url
    const httpTxtProxies = httpTxtLines.map(line => {
        const [ip, port] = line.split(':');
        return `http://${ip}:${port}`;
    });
    // add to proxyCache
    proxyCache = proxyCache.concat(httpTxtProxies.map(url => ({ url })));
};

interface ISearchOpt {
    timeout?: number;
    protocol?: 'http' | 'https';
    verboseLogging?: boolean;
    retestAllows?: boolean;
    retestDenies?: boolean;
    saveOnChange?: boolean;
}

export const testProxyUrl = async (proxyUrl: string, opt: ISearchOpt = {}) => {
    const agent = HttpsProxyAgent(proxyUrl);
    const abortController = new AbortController();
    const { signal } = abortController;
    const fetchOpt = {
        agent,
        signal,
        timeout: opt.timeout || 20000,
    };
    const fetchPromise = fetch('https://httpbin.org/ip?json', fetchOpt);
    const timeoutId = setTimeout(() => {
        abortController.abort();
    }, fetchOpt.timeout);
    try {
        const response = await fetchPromise;
        const body = await response.text();
        if (response.ok) {
            if (opt.verboseLogging) console.warn('* success', body);
            clearTimeout(timeoutId);
            return true;
        }
    } catch (err) {
        if (opt.verboseLogging) console.warn('* failed', (err as Error).message);
        return false;
    }
};

export const clearDenyList = () => { proxyDenyList.length = 0; }
export const clearAllowList = () => { proxyAllowList.length = 0; }
export const getDenyList = () => proxyDenyList;
export const getAllowList = () => proxyAllowList;
export const saveDenyList = (filename: string) => {
    fs.writeFileSync(filename, JSON.stringify(proxyDenyList, null, 2));
};
export const loadDenyList = (filename: string) => {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        const arr = JSON.parse(data);
        proxyDenyList = [...arr];
    } catch (err) {
    }
};
export const saveAllowList = (filename: string) => {
    fs.writeFileSync(filename, JSON.stringify(proxyAllowList, null, 2));
};
export const loadAllowList = (filename: string) => {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        const arr = JSON.parse(data);
        proxyAllowList = [...arr];
    } catch (err) {
    }
};

export const testProxyCache = async (opt: ISearchOpt = {}) => {
    if (opt.verboseLogging) console.warn('* testProxyCache', opt);

    if (!proxyCache.length) {
        await updateProxyCache();
    }

    if (opt.verboseLogging) console.warn(`* proxyCache.length: ${proxyCache.length}`);

    let testProxy: Partial<IFreeProxy> | null = null;
    let index = 0;
    while (index <= proxyCache.length) {
        testProxy = proxyCache[index];
        if (!testProxy || !testProxy.url) {
            index++;
            continue;
        }
        if (!opt.retestAllows && proxyAllowList.includes(testProxy.url)) {
            if (opt.verboseLogging) console.warn(`* skipping ${testProxy.url}, already allowlisted`);

            index++;
            continue;
        }
        if (!opt.retestDenies && proxyDenyList.includes(testProxy.url)) {
            if (opt.verboseLogging) console.warn(`* skipping ${testProxy.url}, already denylisted`);

            index++;
            continue;
        }
        if (opt.protocol && testProxy.protocol !== opt.protocol) {
            if (opt.verboseLogging) console.warn(`* skipping ${testProxy.url}, protocol mismatch`);

            index++;
            continue;
        }

        if (opt.verboseLogging) console.warn('* testing proxy', testProxy.url);

        // if in deny or allow list remove before testing
        if (proxyDenyList.includes(testProxy.url)) {
            proxyDenyList.splice(proxyDenyList.indexOf(testProxy.url), 1);
        }
        if (proxyAllowList.includes(testProxy.url)) {
            proxyAllowList.splice(proxyAllowList.indexOf(testProxy.url), 1);
        }

        const result = await testProxyUrl(testProxy.url, opt);
        if (result) {
            proxyAllowList.push(testProxy.url);
            if (opt.saveOnChange) {
                saveAllowList('allowlist.json');
            }
            if (opt.verboseLogging) console.warn('* success');
        } else {
            proxyDenyList.push(testProxy.url);
            if (opt.saveOnChange) {
                saveDenyList('denylist.json');
            }
            if (opt.verboseLogging) console.warn('* failed');
        }
        index++;
    }
};

export async function initProxyFinder() {
    loadAllowList('allowlist.json');
    loadDenyList('denylist.json');
    testProxyCache({
        timeout: 8000,
        verboseLogging: true,
        retestDenies: false,
        saveOnChange: true,
    }).then(() => {
        console.warn('* proxy update completed');
        console.warn('* proxyDenyList', proxyDenyList.length);
        console.warn('* proxyAllowList', proxyAllowList.length);
    });
    // saveAllowList('allowlist.json');
    // saveDenyList('denylist.json');
};

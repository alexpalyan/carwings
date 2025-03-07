"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.api = undefined;

let api = exports.api = (() => {
  var _ref = _asyncToGenerator(function* (action, data) {
    let resp = yield _axios2.default.post(`/api_v230317_NE/gdc/${action}.php`, _querystring2.default.stringify(data));

    if (resp.data.status === 200) {
      console.log(`🍃 api ${action} 👍`);
    } else if (resp.data.status === 401) {
      console.log(`api ${action} 🚫`);
      return resp.data;
    } else {
      console.log(`api ${action} 👎\r\n`, resp);
    }
    return resp.data;
  });

  return function api(_x, _x2) {
    return _ref.apply(this, arguments);
  };
})();

var _blowfishNode = require("blowfish-node");

var _blowfishNode2 = _interopRequireDefault(_blowfishNode);

var _fp = require("lodash/fp");

var _fp2 = _interopRequireDefault(_fp);

var _axios = require("axios");

var _axios2 = _interopRequireDefault(_axios);

var _querystring = require("querystring");

var _querystring2 = _interopRequireDefault(_querystring);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

_axios2.default.defaults.headers.post["Content-Type"] = "application/x-www-form-urlencoded";
_axios2.default.defaults.headers.common["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.3";
_axios2.default.defaults.baseURL = "https://gdcportalgw.its-mo.com";

process.on("unhandledRejection", r => console.log(r));

const initial_app_str = "9s5rfKVuMrT03RtzajWNcA";
const defaultRegionCode = "NNA";
const lg = "en-US";
const tz = "America/Denver";

const tlog = t => _fp2.default.thru(d => {
  console.log(t, d);
  return d;
});

function sleep(ms = 0) {
  return new Promise(r => setTimeout(r, ms));
}

const blowpassword = _fp2.default.curry((passwordEncryptionKey, password) => {
  const bf = new _blowfishNode2.default(passwordEncryptionKey, _blowfishNode2.default.MODE.ECB);
  return bf.encodeToBase64(password);
});

function getsessionid(profile) {
  return profile.VehicleInfoList.vehicleInfo[0].custom_sessionid;
}

function getvin(profile) {
  return profile.VehicleInfoList.vehicleInfo[0].vin;
}

function getregioncode(profile) {
  return profile.CustomerInfo.RegionCode;
}

const acompose = (fn, ...rest) => rest.length ? (() => {
  var _ref2 = _asyncToGenerator(function* (...args) {
    return fn((yield acompose(...rest)(...args)));
  });

  return function () {
    return _ref2.apply(this, arguments);
  };
})() : fn;

const challenge = acompose(r => r.baseprm, () => api("InitialApp_v2", { initial_app_str }));

// rawCredentials => apiCredentials
const genCredentials = (() => {
  var _ref3 = _asyncToGenerator(function* (UserId, password, RegionCode = defaultRegionCode) {
    return _fp2.default.compose(function (Password) {
      return { UserId, Password, RegionCode };
    }, blowpassword((yield challenge())))(password);
  });

  return function genCredentials(_x3, _x4) {
    return _ref3.apply(this, arguments);
  };
})();

// apiCredentials => profile
const userLogin = (() => {
  var _ref4 = _asyncToGenerator(function* (credentials) {
    return yield api("UserLoginRequest", Object.assign({
      initial_app_str,
      lg
    }, credentials));
  });

  return function userLogin(_x5) {
    return _ref4.apply(this, arguments);
  };
})();

// rawCredentials => profile
const authenticate = acompose(userLogin, genCredentials);

// rawCredentials => (apioperation => apiresults)
const loginSession = acompose(s => (() => {
  var _ref5 = _asyncToGenerator(function* (action, args) {
    return yield api(action, Object.assign({}, s, args));
  });

  return function (_x6, _x7) {
    return _ref5.apply(this, arguments);
  };
})(), p => ({
  custom_sessionid: getsessionid(p),
  VIN: getvin(p),
  RegionCode: getregioncode(p)
}), authenticate);

const pollresult = _fp2.default.curry((() => {
  var _ref6 = _asyncToGenerator(function* (session, action, resultKey) {
    let result;
    if (resultKey === "NoNMA") {
      return { resultKey };
    }
    let i = 0;
    do {
      yield sleep(5000);
      result = yield session(action, { resultKey });
      i++;
    } while (result.responseFlag !== "1" || i > 20);

    return result;
  });

  return function (_x8, _x9, _x10) {
    return _ref6.apply(this, arguments);
  };
})());

const longpollrequest = _fp2.default.curry((action, pollaction, session) => {
  return acompose(pollresult(session, pollaction), r => r.resultKey, () => session(action))();
});

const batteryrecords = session => session("BatteryStatusRecordsRequest");
const batterystatuscheckrequest = session => session("BatteryStatusCheckRequest");
const batterystatuscheck = session => longpollrequest("BatteryStatusCheckRequest", "BatteryStatusCheckResultRequest", session);
const batterystartcharging = session => session("BatteryRemoteChargingRequest");

const hvacon = session => longpollrequest("ACRemoteRequest", "ACRemoteResult", session);
const hvacoff = session => longpollrequest("ACRemoteOffRequest", "ACRemoteOffResult", session);
const hvacstatus = session => session("RemoteACRecordsRequest");

const cabintemp = session => longpollrequest("GetInteriorTemperatureRequestForNsp", "GetInteriorTemperatureResultForNsp", session);

//Create the api session
exports.loginSession = loginSession;
exports.hvacOn = hvacon;
exports.hvacOff = hvacoff;
exports.hvacStatus = hvacstatus;
exports.batteryRecords = batteryrecords;
exports.batteryStatusCheckRequest = batterystatuscheckrequest;
exports.batteryStatusCheck = batterystatuscheck;
exports.batteryStartCharging = batterystartcharging;
exports.cabinTemp = cabintemp;

//(async function() {
//let session = await loginSession('bobbytables@gmail.com', 'Tr0ub4dor&3');

//let data = await batteryrecords(session);

//let data = await hvacon(session);

//let carsession = data => session({ ...data, profile.VehicleInfoList.vehicleInfo[0].vin });

/*
  data = await api('InitialApp', {
    initial_app_str
  });
  const key = data.baseprm;

  data = await api('UserLoginRequest', {
    RegionCode,
    UserId: 'email@example.com',
    Password: blowpassword('Tr0ub4dor&3', key),
    initial_app_str
  });
  */

/*
  data = await api('BatteryStatusRecordsRequest', {
    RegionCode,
    VIN,
    custom_sessionid
  });
  */

/*
  data = await api('BatteryStatusCheckRequest', {
    RegionCode,
    VIN,
    custom_sessionid
  });
  */

/*
  data = await api('BatteryStatusCheckResultRequest', {
    RegionCode,
    VIN,
    resultKey: '5fF06yLeE2U5ENi06AAr5LqO285oMuWrzCIWb3aFVVkAItapUA',
    custom_sessionid
  });
  */

/*
  data = await api('RemoteACRecordsRequest', {
    RegionCode,
    VIN,
    custom_sessionid,
    tz
  });
  */

/*
  data = await api('GetScheduledACRemoteRequest', {
    RegionCode,
    VIN,
    custom_sessionid,
    tz // untested
  });
  */

/*
  data = await api('ACRemoteRequest', {
    RegionCode,
    VIN,
    custom_sessionid
  });
  let resultKey = data.resultKey;
  console.log(`start dispatched ${resultKey}`);

  do {
    await sleep(5000);
    console.log(`polling for start`);

    data = await api('ACRemoteResult', {
      RegionCode,
      VIN,
      custom_sessionid,
      resultKey
    });
  } while(data.responseFlag !== '1')
  */

/*
  data = await api('ACRemoteOffRequest', {
    RegionCode,
    VIN,
    custom_sessionid
  });
  let resultKey = data.resultKey;
  console.log(`stop dispatched ${resultKey}`);

  do {
    await sleep(5000);
    console.log(`polling for stop`);

    data = await api('ACRemoteOffResult', {
      RegionCode,
      VIN,
      custom_sessionid,
      resultKey
    });
  } while(data.responseFlag !== '1')
  */

//console.log(data);
//}());
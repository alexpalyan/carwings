import Blowfish from "blowfish-node";
import _ from "lodash/fp";
import axios from "axios";
import querystring from "querystring";

axios.defaults.headers.post["Content-Type"] =
  "application/x-www-form-urlencoded";
axios.defaults.headers.common["User-Agent"] =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.3";
axios.defaults.baseURL = "https://gdcportalgw.its-mo.com";

process.on("unhandledRejection", (r) => console.log(r));

const initial_app_str = "9s5rfKVuMrT03RtzajWNcA";
const defaultRegionCode = "NNA";
const lg = "en-US";
const tz = "America/Denver";

const tlog = (t) =>
  _.thru((d) => {
    console.log(t, d);
    return d;
  });

function sleep(ms = 0) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function api(action, data) {
  let resp = await axios.post(
    `/api_v230317_NE/gdc/${action}.php`,
    querystring.stringify(data),
  );

  if (resp.data.status === 200) {
    console.log(`🍃 api ${action} 👍`);
  } else if (resp.data.status === 401) {
    console.log(`api ${action} 🚫`);
    return resp.data;
  } else {
    console.log(`api ${action} 👎\r\n`, resp);
  }
  return resp.data;
}

const blowpassword = _.curry((passwordEncryptionKey, password) => {
  const bf = new Blowfish(passwordEncryptionKey, Blowfish.MODE.ECB);
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

const acompose = (fn, ...rest) =>
  rest.length ? async (...args) => fn(await acompose(...rest)(...args)) : fn;

const challenge = acompose(
  (r) => r.baseprm,
  () => api("InitialApp_v2", { initial_app_str }),
);

// rawCredentials => apiCredentials
const genCredentials = async (
  UserId,
  password,
  RegionCode = defaultRegionCode,
) => {
  return _.compose(
    (Password) => ({ UserId, Password, RegionCode }),
    blowpassword(await challenge()),
  )(password);
};

// apiCredentials => profile
const userLogin = async (credentials) => {
  return await api("UserLoginRequest", {
    initial_app_str,
    lg,
    ...credentials,
  });
};

// rawCredentials => profile
const authenticate = acompose(userLogin, genCredentials);

// rawCredentials => (apioperation => apiresults)
const loginSession = acompose(
  (s) => async (action, args) => await api(action, { ...s, ...args }),
  (p) => ({
    custom_sessionid: getsessionid(p),
    VIN: getvin(p),
    RegionCode: getregioncode(p),
  }),
  authenticate,
);

const pollresult = _.curry(async (session, action, resultKey) => {
  let result;
  if (resultKey === "NoNMA") {
    return { resultKey };
  }
  let i = 0;
  do {
    await sleep(5000);
    result = await session(action, { resultKey });
    i++;
  } while (result.responseFlag !== "1" || i > 20);

  return result;
});

const longpollrequest = _.curry((action, pollaction, session) => {
  return acompose(
    pollresult(session, pollaction),
    (r) => r.resultKey,
    () => session(action),
  )();
});

const batteryrecords = (session) => session("BatteryStatusRecordsRequest");
const batterystatuscheckrequest = (session) =>
  session("BatteryStatusCheckRequest");
const batterystatuscheck = (session) =>
  longpollrequest(
    "BatteryStatusCheckRequest",
    "BatteryStatusCheckResultRequest",
    session,
  );
const batterystartcharging = (session) =>
  session("BatteryRemoteChargingRequest");

const hvacon = (session) =>
  longpollrequest("ACRemoteRequest", "ACRemoteResult", session);
const hvacoff = (session) =>
  longpollrequest("ACRemoteOffRequest", "ACRemoteOffResult", session);
const hvacstatus = (session) => session("RemoteACRecordsRequest");

const cabintemp = (session) =>
  longpollrequest(
    "GetInteriorTemperatureRequestForNsp",
    "GetInteriorTemperatureResultForNsp",
    session,
  );

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

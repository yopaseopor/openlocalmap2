async function invoke(path) {
  try {
    const fn = require('./' + path);
    let headers = {};
    const res = {
      headersSet: {},
      statusCode: 200,
      setHeader(k,v){ this.headersSet[k]=v; },
      status(code){ this.statusCode = code; return this; },
      json(obj){ console.log('JSON RESPONSE (status', this.statusCode+'):'); console.log(JSON.stringify(obj,null,2)); },
      end(msg){ console.log('END:', msg); }
    };
    const req = { method: 'GET', query: {} };
    console.log('Invoking', path);
    await fn(req, res);
    console.log('Done', path);
  } catch (e) {
    console.error('ERROR invoking', path, e && e.stack ? e.stack : e);
  }
}

(async ()=>{
  await invoke('api/renfe-trains.js');
  await invoke('api/tmb-buses.js');
})();

var promisesAplusTests = require('promises-aplus-tests');
var adapter = require('./adapter');
promisesAplusTests(adapter, function (err) {
    if (err) {
        console.log('测试完成');
    } else {
        console.error(`存在一些错误 ${err}`);
    }
});

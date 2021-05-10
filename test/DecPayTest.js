
// DecPay
const DecPay = artifacts.require("DecPay");

// ERC20 token
const TTToken = artifacts.require("TTToken");

contract('DecPay', async accounts => {

    it('create application success not exists', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        let result = await instance.createApp('decpay1', accounts[1], { from: accounts[0] });

        assert.equal('ApplicationCreatedEvent', result.logs[0].event);
    })

    it('create application error when application has exist', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        let result = await instance.createApp('decpay3', accounts[0], { from: accounts[0] });

        assert.equal('ApplicationCreatedEvent', result.logs[0].event);

        try {
            await instance.createApp('decpay3', accounts[0], { from: accounts[0] });
        } catch (e) {
            assert.equal('DecPay: Application has exist', e.reason);
        }
    })

    it('queryApp test', async () => {
        let instance = await DecPay.new({ from: accounts[2] });

        let _app = 'decpay1-2';

        let appOwner = await instance.queryApp(_app);
        assert.equal('0x0000000000000000000000000000000000000000', appOwner);

        await instance.createApp(_app, accounts[1], { from: accounts[0] });

        appOwner = await instance.queryApp(_app);
        assert.equal(accounts[1], appOwner);
    })

    it('appCount test', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp('decpay1', accounts[1], { from: accounts[0] });

        let appCount = await instance.getAppCount();
        assert.equal(1, appCount);

        await instance.createApp('decpay1-1', accounts[1], { from: accounts[0] });

        appCount = await instance.getAppCount();
        assert.equal(2, appCount);

        await instance.createApp('decpay1-2', accounts[1], { from: accounts[0] });
        await instance.createApp('decpay1-3', accounts[1], { from: accounts[0] });
        await instance.createApp('decpay1-4', accounts[1], { from: accounts[0] });

        appCount = await instance.getAppCount();
        assert.equal(5, appCount);
    })

    it('application default status is false', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        let _app = 'decpay4';
        await instance.createApp(_app, accounts[0], { from: accounts[0] });
        let result = await instance.getAppStatus(_app);
        assert.isNotOk(result);
    })


    it('set app status success', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        let _app = 'decpay5';
        await instance.createApp(_app, accounts[0], { from: accounts[0] });
        await instance.setAppStatus(_app, true, { from: accounts[0] });
        let result = await instance.getAppStatus(_app);
        assert.ok(result);
    })

    it('set app status failure with non owner', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        let _app = 'decpay6';
        await instance.createApp(_app, accounts[0], { from: accounts[0] });
        try {
            await instance.setAppStatus(_app, true, { from: accounts[1] });
        } catch (e) {
            assert.equal('DecPay: No permission', e.reason);
        }
    })

    it('application balance default is zero', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        let _app = 'decpay7';
        await instance.createApp(_app, accounts[0], { from: accounts[0] });
        let result = await instance.queryAppBalance(_app);
        assert.equal(0, result);
    })

    it('eth pay success', async () => {
        let order = {
            _app: 'decpay8',
            _orderNo: 'orderNo1',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        // pay
        let result = await instance.pay(
            order._app,
            order._orderNo,
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        let log = result.logs[0];
        assert.equal('PaySuccessEvent', log.event);
        assert.equal(order._app, log.args._app);
        assert.equal('', log.args.token);
        assert.equal(order._orderNo, log.args._orderNo);
        assert.equal(order._total, log.args._payTotal);
        assert.equal(accounts[1], log.args._paidAddress);

        // balanceQuery
        let balance = await instance.queryAppBalance(order._app);
        assert.equal(order._total, balance);
        // orderQuery
        let createdOrder = await instance.queryOrder(order._app, order._orderNo);
        assert.equal('', createdOrder[0]);
        assert.equal(order._total, createdOrder[1]);
        assert.equal(order._total, createdOrder[2]);
        assert.equal(accounts[1], createdOrder[4]);

        // orderCount
        let orderCount = await instance.getOrderCount();
        assert.equal(1, orderCount);

        // appOrderCount
        let appOrderCount = await instance.queryAppOrderCount(order._app);
        assert.equal(1, appOrderCount);

    })

    it('eth pay fail with no pay eth or wrong value', async () => {
        let order = {
            _app: 'decpay9',
            _orderNo: 'orderNo2',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        // pay
        try {
            await instance.pay(
                order._app,
                order._orderNo,
                order._total,
                order._expiredAt,
                {
                    from: accounts[1],
                    value: 0
                }
            );
        } catch (e) {
            assert.equal('DecPay: Wrong payment amount', e.reason);
        }

        try {
            await instance.pay(
                order._app,
                order._orderNo,
                order._total,
                order._expiredAt,
                {
                    from: accounts[1],
                    value: order._total - 1
                }
            );
        } catch (e) {
            assert.equal('DecPay: Wrong payment amount', e.reason);
        }

        try {
            await instance.pay(
                order._app,
                order._orderNo,
                order._total,
                order._expiredAt,
                {
                    from: accounts[1],
                    value: order._total + 1
                }
            );
        } catch (e) {
            assert.equal('DecPay: Wrong payment amount', e.reason);
        }
    });

    it('eth pay fail with order epxired', async () => {
        let order = {
            _app: 'decpay10',
            _orderNo: 'orderNo1',
            _total: 100000,
            _expiredAt: 1620555483 // 2021/05/9 18:18
        }

        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        // pay
        try {
            await instance.pay(
                order._app,
                order._orderNo,
                order._total,
                order._expiredAt,
                {
                    from: accounts[1],
                    value: order._total
                }
            );
        } catch (e) {
            assert.equal('DecPay: Order has expired', e.reason);
        }
    });

    it('eth pay fail with repeat order', async () => {
        let order = {
            _app: 'decpay11',
            _orderNo: 'orderNo4',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        // pay
        let result = await instance.pay(
            order._app,
            order._orderNo,
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        let log = result.logs[0];
        assert.equal('PaySuccessEvent', log.event);

        // repeat pay
        try {
            await instance.pay(
                order._app,
                order._orderNo,
                order._total,
                order._expiredAt,
                {
                    from: accounts[1],
                    value: order._total
                }
            );
        } catch (e) {
            assert.equal('DecPay: Order already exists', e.reason);
        }
    });

    it('add erc20 token success', async () => {
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: accounts[3] });

        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: accounts[3] });
        let ttTokenAddress = erc20Instance.address;

        // set erc20 support
        await instance.addToken('TT', ttTokenAddress, { from: accounts[3] });
        // query token
        let result = await instance.queryToken('TT');
        assert.equal(ttTokenAddress, result);
    });

    it('add erc20 token fail with non contract owner', async () => {
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: accounts[3] });

        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: accounts[3] });
        let ttTokenAddress = erc20Instance.address;

        // set erc20 support
        try {
            await instance.addToken('TT', ttTokenAddress, { from: accounts[4] });
        } catch (e) {
            assert.equal('Ownable: caller is not the owner', e.reason);
        }
    });


    it('erc20 token pay success', async () => {
        let order = {
            _app: 'decpay13',
            _orderNo: 'orderNo5',
            _token: 'TT',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, order._total, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        await erc20Instance.approve(instance.address, order._total, { from: spenderAddress });

        // token pay
        let result = await instance.tokenPay(
            order._app,
            order._orderNo,
            order._token,
            order._total,
            order._expiredAt,
            {
                from: spenderAddress
            }
        );

        let log = result.logs[0];
        assert.equal('PaySuccessEvent', log.event);
        assert.equal(order._app, log.args._app);
        assert.equal(order._token, log.args.token);
        assert.equal(order._orderNo, log.args._orderNo);
        assert.equal(order._total, log.args._payTotal);
        assert.equal(spenderAddress, log.args._paidAddress);

        // orderQuery
        let createdOrder = await instance.queryOrder(order._app, order._orderNo);
        assert.equal(order._token, createdOrder[0]);
        assert.equal(order._total, createdOrder[1]);
        assert.equal(order._total, createdOrder[2]);
        assert.equal(spenderAddress, createdOrder[4]);

        // queryTokenBalance
        let tokenBalance = await instance.queryAppTokenBalance(order._app, order._token, { from: accounts[5] });
        assert.equal(order._total, tokenBalance);

        // queryDecPayTokenBalance
        let decpayTokenBalance = await erc20Instance.balanceOf(instance.address);
        assert.equal(order._total, decpayTokenBalance);

        // orderCount
        let orderCount = await instance.getOrderCount();
        assert.equal(1, orderCount);

        // appOrderCount
        let appOrderCount = await instance.queryAppOrderCount(order._app);
        assert.equal(1, appOrderCount);
    });

    it('erc20 token pay fail when order has exist', async () => {
        let order = {
            _app: 'decpay14',
            _orderNo: 'orderNo6',
            _token: 'TT',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, order._total, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        await erc20Instance.approve(instance.address, order._total, { from: spenderAddress });

        // token pay
        await instance.tokenPay(
            order._app,
            order._orderNo,
            order._token,
            order._total,
            order._expiredAt,
            {
                from: spenderAddress
            }
        );

        try {
            await instance.tokenPay(
                order._app,
                order._orderNo,
                order._token,
                order._total,
                order._expiredAt,
                {
                    from: spenderAddress
                }
            );
        } catch (e) {
            assert.equal('DecPay: Order already exists', e.reason);
        }
    });

    it('erc20 token pay fail when token balance insufficient', async () => {
        let order = {
            _app: 'decpay15',
            _orderNo: 'orderNo7',
            _token: 'TT',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, order._total - 1, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        await erc20Instance.approve(instance.address, order._total, { from: spenderAddress });

        try {
            await instance.tokenPay(
                order._app,
                order._orderNo,
                order._token,
                order._total,
                order._expiredAt,
                {
                    from: spenderAddress
                }
            );
        } catch (e) {
            assert.equal('ERC20: transfer amount exceeds balance', e.reason);
        }
    });

    it('erc20 token pay fail when token not approve', async () => {
        let order = {
            _app: 'decpay16',
            _orderNo: 'orderNo8',
            _token: 'TT',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, order._total + 1, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        // await erc20Instance.approve(instance.address, order._total, { from: spenderAddress });

        try {
            await instance.tokenPay(
                order._app,
                order._orderNo,
                order._token,
                order._total,
                order._expiredAt,
                {
                    from: spenderAddress
                }
            );
        } catch (e) {
            assert.equal('ERC20: transfer amount exceeds allowance', e.reason);
        }
    });

    it('erc20 token pay fail when token unsupport', async () => {
        let order = {
            _app: 'decpay19',
            _orderNo: 'orderNo9',
            _token: 'TT',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        // await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, order._total + 1, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        await erc20Instance.approve(instance.address, order._total, { from: spenderAddress });

        try {
            await instance.tokenPay(
                order._app,
                order._orderNo,
                order._token,
                order._total,
                order._expiredAt,
                {
                    from: spenderAddress
                }
            );
        } catch (e) {
            assert.equal('DecPay: token has not exist', e.reason);
        }
    });

    it('erc20 token pay fail when order expired', async () => {
        let order = {
            _app: 'decpay20',
            _orderNo: 'orderNo10',
            _token: 'TT',
            _total: 100000,
            _expiredAt: 1620555483 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, order._total + 1, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        await erc20Instance.approve(instance.address, order._total, { from: spenderAddress });

        try {
            await instance.tokenPay(
                order._app,
                order._orderNo,
                order._token,
                order._total,
                order._expiredAt,
                {
                    from: spenderAddress
                }
            );
        } catch (e) {
            assert.equal('DecPay: Order has expired', e.reason);
        }
    });

    it('withdraw success', async () => {
        let order = {
            _app: 'decpay30',
            _orderNo: 'orderNo20',
            _total: 201,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        // pay
        await instance.pay(
            order._app,
            order._orderNo,
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        let result = await instance.withdraw(order._app, 100, { from: accounts[0] });

        let log = result.logs[0];
        assert.equal('WithdrawSuccessEvent', log.event);
        assert.equal(order._app, log.args._app);
        assert.equal('', log.args._token);
        assert.equal(100, log.args._total);

        // queryBalance is 100
        let balance = await instance.queryAppBalance(order._app);
        assert.equal(101, balance);

        // continue withdraw
        try {
            await instance.withdraw(order._app, 102, { from: accounts[0] });
        } catch (e) {
            assert.equal('DecPay: Insufficient balance', e.reason);
        }

        let result1 = await instance.withdraw(order._app, 101, { from: accounts[0] });
        let log1 = result1.logs[0];
        assert.equal('WithdrawSuccessEvent', log1.event);

        // queryBalance is 0
        let balance1 = await instance.queryAppBalance(order._app);
        assert.equal(0, balance1);
    });

    it('withdraw fail with non owner submit', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp('decpay24', accounts[0], { from: accounts[0] });

        try {
            await instance.withdraw('decpay24', 100000, { from: accounts[1] });
        } catch (e) {
            assert.equal('DecPay: No permission', e.reason);
        }
    });

    it('withdraw fail when balance insufficient', async () => {
        let instance = await DecPay.new({ from: accounts[2] });
        await instance.createApp('decpay25', accounts[0], { from: accounts[0] });

        try {
            await instance.withdraw('decpay25', 100000, { from: accounts[0] });
        } catch (e) {
            assert.equal('DecPay: Insufficient balance', e.reason);
        }
    });

    it('token withdraw success', async () => {
        let order = {
            _app: 'decpay27',
            _orderNo: 'orderNo27',
            _token: 'TT',
            _total: 300,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, order._total, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        await erc20Instance.approve(instance.address, order._total, { from: spenderAddress });

        // token pay
        await instance.tokenPay(
            order._app,
            order._orderNo,
            order._token,
            order._total,
            order._expiredAt,
            {
                from: spenderAddress
            }
        );

        let result = await instance.tokenWithdraw(order._app, order._token, 100, { from: accounts[0] });

        let log = result.logs[0];
        assert.equal('WithdrawSuccessEvent', log.event);
        assert.equal(order._app, log.args._app);
        assert.equal(order._token, log.args._token);
        assert.equal(100, log.args._total);

        // query accounts[0] balance
        let a1Balance = await erc20Instance.balanceOf(accounts[0]);
        assert.equal(100, a1Balance);

        // query app token balance
        let appTokenBalance = await instance.queryAppTokenBalance(order._app, order._token);
        assert.equal(200, appTokenBalance);

        try {
            await instance.tokenWithdraw(order._app, order._token, 201, { from: accounts[0] });
        } catch (e) {
            assert.equal('DecPay: Insufficient balance', e.reason);
        }

        result = await instance.tokenWithdraw(order._app, order._token, 200, { from: accounts[0] });
        assert.equal('WithdrawSuccessEvent', log.event);

        // query accounts[0] balance
        a1Balance = await erc20Instance.balanceOf(accounts[0]);
        assert.equal(300, a1Balance);

        // query app token balance
        appTokenBalance = await instance.queryAppTokenBalance(order._app, order._token);
        assert.equal(0, appTokenBalance);
    })

    it('token withdraw fail with non owner', async () => {
        let order = {
            _app: 'decpay28',
            _orderNo: 'orderNo28',
            _token: 'TT',
            _total: 300,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });
        // register application
        await instance.createApp(order._app, accounts[0], { from: accounts[0] });

        try {
            await instance.tokenWithdraw(order._app, order._token, order._total, { from: accounts[2] });
        } catch (e) {
            assert.equal('DecPay: No permission', e.reason);
        }
    })

    it('queryAppOrderCount and queryAppOrderCountMulti test with eth pay', async () => {
        let order = {
            _app: 'decpay29',
            _orderNo: 'orderNo29',
            _total: 100,
            _expiredAt: 1841480283 // 2028/05/9
        }
        let order1 = {
            _app: 'decpay30',
            _orderNo: 'orderNo30',
            _total: 100,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.new({ from: accounts[2] });

        await instance.createApp(order._app, accounts[0]);
        await instance.createApp(order1._app, accounts[1]);

        // pay
        await instance.pay(
            order._app,
            order._orderNo,
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        let appOrderCount = await instance.queryAppOrderCount(order._app);
        assert.equal(1, appOrderCount);

        // multiQuery
        let appOrderCountMulti = await instance.queryAppOrderCountMulti([order._app, order1._app]);
        assert.equal(1, appOrderCountMulti[0]);
        assert.equal(0, appOrderCountMulti[1]);

        // pay
        await instance.pay(
            order1._app,
            order1._orderNo,
            order1._total,
            order1._expiredAt,
            {
                from: accounts[4],
                value: order1._total
            }
        );

        let app1OrderCount = await instance.queryAppOrderCount(order1._app);
        assert.equal(1, app1OrderCount);

        // multiQuery
        appOrderCountMulti = await instance.queryAppOrderCountMulti([order._app, order1._app]);
        assert.equal(1, appOrderCountMulti[0]);
        assert.equal(1, appOrderCountMulti[1]);

        // pay
        order._orderNo = 'orderNo29-1';
        await instance.pay(
            order._app,
            order._orderNo,
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        let appOrderCount1 = await instance.queryAppOrderCount(order._app);
        assert.equal(2, appOrderCount1);

        // multiQuery
        appOrderCountMulti = await instance.queryAppOrderCountMulti([order._app, order1._app]);
        assert.equal(2, appOrderCountMulti[0]);
        assert.equal(1, appOrderCountMulti[1]);

        // query orderCount
        let orderCount = await instance.getOrderCount();
        assert.equal(3, orderCount);
    })

    it('queryAppOrderCount and queryAppOrderCountMulti test with token pay', async () => {
        let order = {
            _app: 'decpay29',
            _orderNo: 'orderNo29',
            _total: 100,
            _token: 'TT',
            _expiredAt: 1841480283 // 2028/05/9
        }
        let order1 = {
            _app: 'decpay30',
            _orderNo: 'orderNo30',
            _token: 'TT',
            _total: 100,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });

        await instance.createApp(order._app, accounts[0]);
        await instance.createApp(order1._app, accounts[1]);

        // erc20 contract deployed
        let erc20Instance = await TTToken.new(200000000, { from: mainContractOwner });
        let ttTokenAddress = erc20Instance.address;
        // set erc20 support
        await instance.addToken(order._token, ttTokenAddress, { from: mainContractOwner });

        let spenderAddress = accounts[1];

        // trnasfer tt token
        await erc20Instance.transfer(spenderAddress, 5000, { from: mainContractOwner });
        // approve DecPay contract spend tt token
        await erc20Instance.approve(instance.address, 5000, { from: spenderAddress });

        // token pay
        await instance.tokenPay(
            order._app,
            order._orderNo,
            order._token,
            order._total,
            order._expiredAt,
            {
                from: spenderAddress
            }
        );

        let appOrderCount = await instance.queryAppOrderCount(order._app);
        assert.equal(1, appOrderCount);

        // multiQuery
        let appOrderCountMulti = await instance.queryAppOrderCountMulti([order._app, order1._app]);
        assert.equal(1, appOrderCountMulti[0]);
        assert.equal(0, appOrderCountMulti[1]);

        // pay
        // token pay
        await instance.tokenPay(
            order1._app,
            order1._orderNo,
            order1._token,
            order1._total,
            order1._expiredAt,
            {
                from: spenderAddress
            }
        );

        let app1OrderCount = await instance.queryAppOrderCount(order1._app);
        assert.equal(1, app1OrderCount);

        // multiQuery
        appOrderCountMulti = await instance.queryAppOrderCountMulti([order._app, order1._app]);
        assert.equal(1, appOrderCountMulti[0]);
        assert.equal(1, appOrderCountMulti[1]);

        // pay
        order._orderNo = 'orderNo29-1';
        await instance.tokenPay(
            order._app,
            order._orderNo,
            order._token,
            order._total,
            order._expiredAt,
            {
                from: spenderAddress
            }
        );

        let appOrderCount1 = await instance.queryAppOrderCount(order._app);
        assert.equal(2, appOrderCount1);

        // multiQuery
        appOrderCountMulti = await instance.queryAppOrderCountMulti([order._app, order1._app]);
        assert.equal(2, appOrderCountMulti[0]);
        assert.equal(1, appOrderCountMulti[1]);

        // query orderCount
        let orderCount = await instance.getOrderCount();
        assert.equal(3, orderCount);
    })


    it('getAppOrderNoPaginate test with eth pay', async () => {
        let order = {
            _app: 'decpay32',
            _orderNo: 'orderNo32',
            _total: 100,
            _expiredAt: 1841480283 // 2028/05/9
        }
        let order1 = {
            _app: 'decpay33',
            _orderNo: 'orderNo33',
            _total: 100,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.new({ from: accounts[2] });

        await instance.createApp(order._app, accounts[0]);
        await instance.createApp(order1._app, accounts[1]);

        // pay
        await instance.pay(
            order._app,
            order._orderNo,
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        let orders = await instance.getAppOrderNoPaginate(order._app, 0, 1);
        assert.equal(order._orderNo, orders[0].orderNo);

        // pay
        await instance.pay(
            order1._app,
            order1._orderNo,
            order1._total,
            order1._expiredAt,
            {
                from: accounts[4],
                value: order1._total
            }
        );

        // pay
        await instance.pay(
            order._app,
            'orderNo32-1',
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        orders = await instance.getAppOrderNoPaginate(order._app, 0, 2);
        assert.equal(order._orderNo, orders[0].orderNo);
        assert.equal('orderNo32-1', orders[1].orderNo);
    })

    it('queryOrderMulti test with eth pay', async () => {
        let order = {
            _app: 'decpay32',
            _orderNo: 'orderNo32',
            _total: 100,
            _expiredAt: 1841480283 // 2028/05/9
        }
        let order1 = {
            _app: 'decpay33',
            _orderNo: 'orderNo33',
            _total: 100,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.new({ from: accounts[2] });

        await instance.createApp(order._app, accounts[0]);
        await instance.createApp(order1._app, accounts[1]);

        // pay
        await instance.pay(
            order._app,
            order._orderNo,
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        let orders = await instance.queryOrderMulti(order._app, [order._orderNo]);
        assert.equal(order._orderNo, orders[0].orderNo);

        // pay
        await instance.pay(
            order1._app,
            order1._orderNo,
            order1._total,
            order1._expiredAt,
            {
                from: accounts[4],
                value: order1._total
            }
        );

        // pay
        await instance.pay(
            order._app,
            'orderNo32-1',
            order._total,
            order._expiredAt,
            {
                from: accounts[1],
                value: order._total
            }
        );

        orders = await instance.queryOrderMulti(order._app, [order._orderNo, 'orderNo32-1']);
        assert.equal(order._orderNo, orders[0].orderNo);
        assert.equal('orderNo32-1', orders[1].orderNo);
    })

});
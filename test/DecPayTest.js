
// DecPay
const DecPay = artifacts.require("DecPay");

// ERC20 token
const TTToken = artifacts.require("TTToken");

contract('DecPay', async accounts => {

    it('create application success not exists', async () => {
        let instance = await DecPay.deployed();
        let result = await instance.createApp('decpay1', accounts[0], { from: accounts[0] });

        assert.equal('ApplicationCreatedEvent', result.logs[0].event);
    })

    it('create application error address params', async () => {
        let instance = await DecPay.deployed();
        try {
            await instance.createApp('decpay2', accounts[0], { from: accounts[1] });
        } catch (e) {
            assert.equal('DecPay: No permission', e.reason);
        }

        try {
            await instance.createApp('decpay2', accounts[1], { from: accounts[0] });
        } catch (e) {
            assert.equal('DecPay: No permission', e.reason);
        }
    })

    it('create application error when application has exist', async () => {
        let instance = await DecPay.deployed();
        let result = await instance.createApp('decpay3', accounts[0], { from: accounts[0] });

        assert.equal('ApplicationCreatedEvent', result.logs[0].event);

        try {
            await instance.createApp('decpay3', accounts[0], { from: accounts[0] });
        } catch (e) {
            assert.equal('DecPay: Application has exist', e.reason);
        }
    })

    it('application default status is false', async () => {
        let instance = await DecPay.deployed();
        let _app = 'decpay4';
        await instance.createApp(_app, accounts[0], { from: accounts[0] });
        let result = await instance.getAppStatus(_app);
        assert.isNotOk(result);
    })


    it('set app status success', async () => {
        let instance = await DecPay.deployed();
        let _app = 'decpay5';
        await instance.createApp(_app, accounts[0], { from: accounts[0] });
        await instance.setAppStatus(_app, true, { from: accounts[0] });
        let result = await instance.getAppStatus(_app);
        assert.ok(result);
    })

    it('set app status failure with non owner', async () => {
        let instance = await DecPay.deployed();
        let _app = 'decpay6';
        await instance.createApp(_app, accounts[0], { from: accounts[0] });
        try {
            await instance.setAppStatus(_app, true, { from: accounts[1] });
        } catch (e) {
            assert.equal('DecPay: No permission', e.reason);
        }
    })

    it('application balance default is zero', async () => {
        let instance = await DecPay.deployed();
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

        let instance = await DecPay.deployed();
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
    })

    it('eth pay fail with no pay eth or wrong value', async () => {
        let order = {
            _app: 'decpay9',
            _orderNo: 'orderNo2',
            _total: 100000,
            _expiredAt: 1841480283 // 2028/05/9
        }

        let instance = await DecPay.deployed();
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

        let instance = await DecPay.deployed();
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

        let instance = await DecPay.deployed();
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

        let instance = await DecPay.deployed();
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
        let instance = await DecPay.deployed();
        await instance.createApp('decpay24', accounts[0], { from: accounts[0] });

        try {
            await instance.withdraw('decpay24', 100000, { from: accounts[1] });
        } catch (e) {
            assert.equal('DecPay: No permission', e.reason);
        }
    });

    it('withdraw fail when balance insufficient', async () => {
        let instance = await DecPay.deployed();
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

    it('owner create application', async () => {
        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });

        let result = await instance.ownerCreateApp('decpay29', accounts[3], {
            from: mainContractOwner
        });

        let log = result.logs[0];
        assert.equal('ApplicationCreatedEvent', log.event);
        assert.equal('decpay29', log.args[0]);
        assert.equal(accounts[3], log.args[1]);
    })

    it('owner create application fail with non owner', async () => {
        let mainContractOwner = accounts[3];
        // main contract - owner[accounts[3]]
        let instance = await DecPay.new({ from: mainContractOwner });

        try {
            await instance.ownerCreateApp('decpay29', accounts[1], {
                from: accounts[4]
            });
        } catch (e) {
            assert.equal('Ownable: caller is not the owner', e.reason);
        }
    })

});
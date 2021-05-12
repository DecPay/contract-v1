// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DecPay is Ownable, ReentrancyGuard {
    // Order Model
    struct AppOrderModel {
        // Application name
        string app;
        // OrderNo
        string orderNo;
        // Pay Token
        string token;
        // Should Pay Total
        uint256 total;
        // Paid Total
        uint256 payTotal;
        // Paid timestamp
        uint256 paidTimestamp;
        // Paid User Address
        address paidAddress;
    }

    // Application Count
    uint256 internal appCount;

    // OrderCount
    uint256 internal orderCount;

    // Applications List
    mapping(string => address payable) internal apps;

    // Application Status
    mapping(string => bool) internal appStatus;

    // Application ETH Balance
    mapping(string => uint256) internal appBalance;

    // Application Token Balance
    mapping(string => mapping(string => uint256)) internal appTokenBalance;

    // Application Orders
    mapping(string => mapping(string => AppOrderModel)) internal appOrders;

    // Application Order Count
    mapping(string => uint256) internal appOrderCount;

    // Application OrderNo List
    mapping(string => string[]) internal appOrderNoList;

    // Tokens
    mapping(string => ERC20) internal tokens;

    // Token Status
    mapping(string => bool) internal tokenStatus;

    // ----- Event Start -----
    // Payment Success event
    event PaySuccessEvent(
        string _app,
        string _orderNo,
        string token,
        uint256 _payTotal,
        uint256 _paidTimestamp,
        address _paidAddress
    );

    // Successful withdraw event
    event WithdrawSuccessEvent(string _app, string _token, uint256 _total);

    // Created Application
    event ApplicationCreatedEvent(string _app, address _owner);

    // ----- Event End -----

    // ----- Modifier Start -----
    // modifies
    modifier appOwner(string memory _app) {
        require(apps[_app] == _msgSender(), "DecPay: No permission");
        _;
    }

    // Application must exist
    modifier appMustExist(string memory _app) {
        require(apps[_app] != address(0), "DecPay: Application does not exist");
        _;
    }

    // Application Status must be false
    modifier appStatusOk(string memory _app) {
        require(appStatus[_app] == false, "DecPay: Application paused");
        _;
    }

    // ----- Modifier End -----

    function getAppCount() public view returns (uint256) {
        return appCount;
    }

    function getOrderCount() public view returns (uint256) {
        return orderCount;
    }

    // Create Application
    function createApp(string memory _app, address payable _ownerAddress)
        public
    {
        require(apps[_app] == address(0), "DecPay: Application has exist");

        apps[_app] = _ownerAddress;

        appCount += 1;

        emit ApplicationCreatedEvent(_app, _msgSender());
    }

    function resetAppOwner(string memory _app, address payable _ownerAddress)
        public
        appOwner(_app)
    {
        apps[_app] = _ownerAddress;
    }

    // Application Query
    function queryApp(string memory _app) public view returns (address) {
        return apps[_app];
    }

    // Application OrderCount
    function queryAppOrderCount(string memory _app)
        public
        view
        returns (uint256)
    {
        return appOrderCount[_app];
    }

    // Application OrderCount MultiQuery
    function queryAppOrderCountMulti(string[] memory _apps)
        public
        view
        returns (uint256[] memory)
    {
        uint256[] memory arr = new uint256[](_apps.length);

        for (uint256 i = 0; i < _apps.length; i++) {
            arr[i] = appOrderCount[_apps[i]];
        }

        return arr;
    }

    function getAppOrderNoPaginate(
        string memory _app,
        uint256 _start,
        uint256 size
    ) public view appMustExist(_app) returns (AppOrderModel[] memory) {
        require(appOrderCount[_app] >= (_start + size), "DecPay: Params error");

        AppOrderModel[] memory _orders = new AppOrderModel[](size);

        for (uint256 i = 0; i < size; i++) {
            _orders[i] = appOrders[_app][appOrderNoList[_app][i + _start]];
        }

        return _orders;
    }

    // Set Application Status
    function setAppStatus(string memory _app, bool _status)
        public
        appOwner(_app)
    {
        appStatus[_app] = _status;
    }

    // Get Application Status
    function getAppStatus(string memory _app) public view returns (bool) {
        return appStatus[_app];
    }

    // Check the available balance of the application
    function queryAppBalance(string memory _app) public view returns (uint256) {
        return appBalance[_app];
    }

    // Application Token Balance query
    function queryAppTokenBalance(string memory _app, string memory _token)
        public
        view
        returns (uint256)
    {
        return appTokenBalance[_app][_token];
    }

    // Application Order MultiQuery
    function queryOrderMulti(string memory _app, string[] memory _orderNoRows)
        public
        view
        appMustExist(_app)
        returns (AppOrderModel[] memory)
    {
        AppOrderModel[] memory _orders =
            new AppOrderModel[](_orderNoRows.length);

        for (uint256 i = 0; i < _orderNoRows.length; i++) {
            _orders[i] = appOrders[_app][_orderNoRows[i]];
        }

        return _orders;
    }

    // Check application orders
    function queryOrder(string memory _app, string memory _orderNo)
        public
        view
        returns (AppOrderModel memory)
    {
        return appOrders[_app][_orderNo];
    }

    // ETH Pay
    function pay(
        string memory _app,
        string memory _orderNo,
        uint256 total,
        uint256 _expiredAt
    ) public payable nonReentrant appMustExist(_app) appStatusOk(_app) {
        require(
            msg.value > 0 && msg.value == total,
            "DecPay: Wrong payment amount"
        );

        require(_expiredAt > block.timestamp, "DecPay: Order has expired");

        require(
            appOrders[_app][_orderNo].payTotal == 0,
            "DecPay: Order already exists"
        );

        appOrders[_app][_orderNo] = AppOrderModel(
            _app,
            _orderNo,
            "",
            total,
            msg.value,
            block.timestamp,
            _msgSender()
        );

        appBalance[_app] += msg.value;

        // statistics
        orderCount += 1;
        appOrderCount[_app] += 1;
        appOrderNoList[_app].push(_orderNo);

        emit PaySuccessEvent(
            _app,
            _orderNo,
            "",
            msg.value,
            block.timestamp,
            _msgSender()
        );
    }

    function tokenPay(
        string memory _app,
        string memory _orderNo,
        string memory _token,
        uint256 _total,
        uint256 _expiredAt
    ) public nonReentrant appMustExist(_app) appStatusOk(_app) {
        require(
            address(tokens[_token]) != address(0),
            "DecPay: token has not exist"
        );

        require(tokenStatus[_token] == false, "DecPay: token unsupport");

        require(_expiredAt > block.timestamp, "DecPay: Order has expired");

        require(
            appOrders[_app][_orderNo].payTotal == 0,
            "DecPay: Order already exists"
        );

        tokens[_token].transferFrom(_msgSender(), address(this), _total);

        appTokenBalance[_app][_token] += _total;

        appOrders[_app][_orderNo] = AppOrderModel(
            _app,
            _orderNo,
            _token,
            _total,
            _total,
            block.timestamp,
            _msgSender()
        );

        // statistics
        orderCount += 1;
        appOrderCount[_app] += 1;
        appOrderNoList[_app].push(_orderNo);

        emit PaySuccessEvent(
            _app,
            _orderNo,
            _token,
            _total,
            block.timestamp,
            _msgSender()
        );
    }

    // ETH Withdraw
    function withdraw(string memory _app, uint256 _total)
        public
        nonReentrant
        appOwner(_app)
    {
        require(appBalance[_app] >= _total, "DecPay: Insufficient balance");

        appBalance[_app] -= _total;

        apps[_app].transfer(_total);

        emit WithdrawSuccessEvent(_app, "", _total);
    }

    // Token Withdraw
    function tokenWithdraw(
        string memory _app,
        string memory _token,
        uint256 _total
    ) public nonReentrant appOwner(_app) {
        require(
            appTokenBalance[_app][_token] >= _total,
            "DecPay: Insufficient balance"
        );

        appTokenBalance[_app][_token] -= _total;

        tokens[_token].transfer(apps[_app], _total);

        emit WithdrawSuccessEvent(_app, _token, _total);
    }

    function queryToken(string memory _token) public view returns (address) {
        return address(tokens[_token]);
    }

    function addToken(string memory _name, ERC20 _tokenAddress)
        public
        onlyOwner
    {
        tokens[_name] = _tokenAddress;
    }

    function setTokenStaus(string memory _token, bool _status)
        public
        onlyOwner
    {
        require(
            address(tokens[_token]) != address(0),
            "DecPay: token has not exist"
        );
        tokenStatus[_token] = _status;
    }

    function getTokenStatus(string memory _token) public view returns (bool) {
        return tokenStatus[_token];
    }
}

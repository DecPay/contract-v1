// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DecPay is Ownable, ReentrancyGuard {
    // Order Model
    struct ORDER {
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

    // Applications List
    mapping(string => address payable) internal apps;

    // Application Balance
    mapping(string => uint256) internal appBalance;

    // Application Orders
    mapping(string => mapping(string => ORDER)) internal appOrders;

    // Application Token Balance
    mapping(string => mapping(string => uint256)) internal appTokenBalance;

    // Tokens
    mapping(string => ERC20) internal tokens;

    // Application Status
    mapping(string => bool) internal appStatus;

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

    // Create Application
    function createApp(string memory _app, address payable _ownerAddress)
        public
    {
        require(apps[_app] == address(0), "DecPay: Application has exist");
        require(_msgSender() == _ownerAddress, "DecPay: No permission");

        apps[_app] = _ownerAddress;

        emit ApplicationCreatedEvent(_app, _msgSender());
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

    function queryAppTokenBalance(string memory _app, string memory _token)
        public
        view
        returns (uint256)
    {
        return appTokenBalance[_app][_token];
    }

    function queryOrders(string memory _app, string[] memory _orderNoRows)
        public
        view
        returns (ORDER[] memory)
    {
        ORDER[] memory orders = new ORDER[](_orderNoRows.length);
        for (uint256 i = 0; i < _orderNoRows.length; i++) {
            orders[i] = appOrders[_app][_orderNoRows[i]];
        }
        return orders;
    }

    // Check application orders
    function queryOrder(string memory _app, string memory _orderNo)
        public
        view
        returns (
            string memory,
            uint256,
            uint256,
            uint256,
            address
        )
    {
        ORDER memory localOrder = appOrders[_app][_orderNo];
        return (
            localOrder.token,
            localOrder.total,
            localOrder.payTotal,
            localOrder.paidTimestamp,
            localOrder.paidAddress
        );
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

        appOrders[_app][_orderNo] = ORDER(
            _app,
            _orderNo,
            "",
            total,
            msg.value,
            block.timestamp,
            _msgSender()
        );

        appBalance[_app] += msg.value;

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

        require(_expiredAt > block.timestamp, "DecPay: Order has expired");

        require(
            appOrders[_app][_orderNo].payTotal == 0,
            "DecPay: Order already exists"
        );

        tokens[_token].transferFrom(_msgSender(), address(this), _total);

        appTokenBalance[_app][_token] += _total;

        appOrders[_app][_orderNo] = ORDER(
            _app,
            _orderNo,
            _token,
            _total,
            _total,
            block.timestamp,
            _msgSender()
        );

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

    function queryToken(string memory _token) public view returns (ERC20) {
        return tokens[_token];
    }

    function addToken(string memory _name, ERC20 _tokenAddress)
        public
        onlyOwner
    {
        tokens[_name] = _tokenAddress;
    }

    function ownerCreateApp(string memory _app, address payable _appOwner)
        public
        onlyOwner
    {
        require(apps[_app] == address(0), "DecPay: Application has exists");
        apps[_app] = _appOwner;
        emit ApplicationCreatedEvent(_app, _appOwner);
    }
}

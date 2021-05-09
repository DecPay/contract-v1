pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TTToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("TT", "TT") {
        _mint(msg.sender, initialSupply);
    }
}
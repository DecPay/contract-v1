const Migrations = artifacts.require("Migrations");
const DecPay = artifacts.require("DecPay");
const TTToken = artifacts.require("TTToken");

module.exports = function (deployer) {
  deployer.deploy(Migrations);
  
  deployer.deploy(DecPay);

  deployer.deploy(TTToken, '100000000000000000000');
};

// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

interface IWETH {
    function deposit() external payable;

    function withdraw(uint256 wad) external;

    function transfer(address dst, uint256 wad) external;

    function balanceOf(address dst) external;

    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);
}

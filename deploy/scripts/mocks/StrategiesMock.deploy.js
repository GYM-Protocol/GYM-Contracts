const { VARIABLES } = require("../../../utils/constants");

module.exports = async function ({ ethers: { getContract }, getChainId, run }) {
	const chainId = await getChainId();

	if (chainId === "31337") {
		const WBNB = await getContract("WBNBMock");
		const wantToken1 = await getContract("WantToken1");
		const wantToken2 = await getContract("WantToken2");

		await run("deploy:strategyMock", {
			contractName: "StrategyMock1",
			wantAddress: wantToken1.address
		});

		await run("deploy:strategyMock", {
			contractName: "StrategyMock2",
			wantAddress: wantToken2.address
		});

		await run("deploy:strategyMock", {
			contractName: "StrategyMock3",
			wantAddress: wantToken2.address
		});

		const strategy = await run("deploy:strategyMock", {
			contractName: "StrategyMock",
			wantAddress: WBNB.address
		});
		VARIABLES.hardhat.GYM_VAULTS_BANK_CORE_POOL_STRATEGY_ADDRESS = strategy;
	}
};

module.exports.tags = ["Strategies"];
module.exports.dependencies = ["Tokens", "WBNBMock"];

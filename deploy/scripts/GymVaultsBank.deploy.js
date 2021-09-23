const { getDeploymentArgs } = require("../../utils");

module.exports = async function (hre) {
	const { owner, deployer } = await hre.ethers.getNamedAccounts();
	const chainId = await hre.ethers.getChainId();
	const deploymentArgs = await getDeploymentArgs(chainId, "GymVaultsBank");

	const options = {
		contractName: "GymVaultsBank",
		args: [deploymentArgs.startBlock, deploymentArgs.gymTokenAddress, deploymentArgs.rewardRate],
		owner: owner,
	};

	const deterministic = await hre.deployments.deterministic("GymVaultsBank", {
		from: deployer,
		contract: "GymVaultsBank",
		args: [...options.args],
		log: true,
		deterministicDeployment: true,
	});

	await deterministic.deploy();

	try {
		await hre.run("verify:verify", {
			address: deterministic.address,
			constructorArguments: options.args,
		});
	} catch (e) {
		console.log(e.toString());
	}

	// await contractDeploy(hre, options, async contract => {
	//     try {
	//         await hre.run("verify:verify", {
	//             address: contract.address,
	//             constructorArguments: options.args
	//         });
	//     } catch (e) {
	//         console.log(e.toString())
	//     }
	// })
};
module.exports.tags = ["GymVaultsBank"];
module.exports.dependencies = ["GymToken", "BuyBack"];
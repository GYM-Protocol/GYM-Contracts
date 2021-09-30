const { getDeploymentArgs } = require("../../utils");

module.exports = async function ({ run, getChainId }) {
	const chainId = 97;
	const deploymentArgs = await getDeploymentArgs(chainId, "GymVaultsStrategyAlpaca");

	const options = {
		contractName: "GymVaultsStrategyAlpaca",
		args: [
			"0xFaBF92Ebd2528aC7C2E9663887b63c01aC7cD884",
			deploymentArgs.isAutoComp,
			deploymentArgs.vault,
			deploymentArgs.fairLaunch,
			deploymentArgs.pid,
			deploymentArgs.want,
			deploymentArgs.earn,
			deploymentArgs.router
		],
		owner: "0xFaBF92Ebd2528aC7C2E9663887b63c01aC7cD884"
	};

	const deterministicDeploy = await run("deploy:gymVaultsStrategy", {
		contractName: "GymVaultsStrategyAlpaca",
		bank: "0xFaBF92Ebd2528aC7C2E9663887b63c01aC7cD884",
		isAutoComp: deploymentArgs.isAutoComp.toString(),
		vault: deploymentArgs.vault,
		fairLaunch: deploymentArgs.fairLaunch,
		pid: deploymentArgs.pid.toString(),
		want: deploymentArgs.want,
		earn: deploymentArgs.earn,
		router: deploymentArgs.router
	});
	try {
		await run("verify:verify", {
			address: deterministicDeploy.address,
			constructorArguments: options.args
		});
	} catch (e) {
		console.log(e.toString());
	}
};
module.exports.tags = ["GymVaultsStrategyAlpaca"];
// module.exports.dependencies = ["GymVaultsBank"];

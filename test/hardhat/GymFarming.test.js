const { expect } = require("chai");
const {
	deployments: { fixture, deploy },
	network,
	ethers: {
		utils: { parseEther },
		provider: { getBlockNumber },
		getContract,
		getNamedSigners,
		BigNumber,
		constants
	},
	run
} = require("hardhat");
const {
	time: { advanceBlock, advanceBlockTo }
} = require("@openzeppelin/test-helpers");
const variables = require("../../utils/constants/solpp")("hardhat");
const data = require("../../utils/constants/data/hardhat/GymFarming.json");

describe("GymFarming contract: ", function () {
	let accounts, deployer, caller, holder, chugun, vzgo, grno;
	let gymFarming, gym, startBlock, snapshotStart, testLp, testLp1, tokenA;
	const amount = parseEther("4");
	const poolAllocPoint1 = 30;
	const poolAllocPoint2 = 50;
	before("Before All: ", async function () {
		accounts = await getNamedSigners();
		({ caller, deployer, holder, chugun, vzgo, grno } = accounts);
		await fixture("Hardhat");
		gymFarming = await getContract("GymFarming", deployer);
		gym = await getContract("GymToken", caller);
		await gym.connect(holder).transfer(gymFarming.address, parseEther("1000000"));

		await deploy("testLp", {
			from: deployer.address,
			contract: "ERC20Mock",
			args: ["LP Token", "LPT", parseEther(amount.mul(5).toString())],
			log: true
		});
		testLp = await getContract("testLp");
		await deploy("testLp1", {
			from: deployer.address,
			contract: "ERC20Mock",
			args: ["LP Tokenq", "LPT1", parseEther(amount.mul(5).toString())],
			log: true
		});
		testLp1 = await getContract("testLp1");

		tokenA = await getContract("TokenA", deployer);

		await testLp.transfer(caller.address, parseEther(amount.toString()));
		await testLp.transfer(chugun.address, parseEther(amount.toString()));
		await testLp.transfer(vzgo.address, parseEther(amount.toString()));
		await testLp1.transfer(vzgo.address, parseEther(amount.toString()));
		await testLp1.transfer(grno.address, parseEther(amount.toString()));

		startBlock = parseInt(await gymFarming.startBlock());
	});

	describe("Initialization: ", function () {
		it("Should initialize with correct values: ", async function () {
			expect(await gymFarming.rewardToken()).to.equal(gym.address);
			expect(await gymFarming.rewardPerBlock()).to.equal(parseEther(data.rewardPerBlock));
			expect(await gymFarming.startBlock()).to.equal(data.startBlock);
		});
	});

	describe("PoolLength function: ", function () {
		before("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		after("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});

		it("PoolLength should execute: ", async function () {
			await run("farming:add", {
				allocPoint: `${poolAllocPoint1}`,
				lpToken: testLp.address,
				withUpdate: "false"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp1.address,
				withUpdate: "true"
			});

			expect(
				await run("farming:poolLength", {
					caller: "deployer"
				})
			).to.equal(2);
		});
	});

	describe("Set function: ", function () {
		beforeEach("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		afterEach("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});

		it("Should set new allocPoint for pid: ", async function () {
			await run("farming:add", {
				allocPoint: `${poolAllocPoint1}`,
				lpToken: testLp.address,
				withUpdate: "false"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp1.address,
				withUpdate: "true"
			});

			await run("farming:set", {
				pid: "0",
				allocPoint: `${poolAllocPoint2}`,
				withUpdate: "true"
			});
			await run("farming:set", {
				pid: "1",
				allocPoint: `${poolAllocPoint1}`,
				withUpdate: "true"
			});

			expect((await gymFarming.poolInfo(0)).allocPoint).to.equal(poolAllocPoint2);
			expect((await gymFarming.poolInfo(1)).allocPoint).to.equal(poolAllocPoint1);
		});

		it("Should revert if invalid pool", async function () {
			await expect(
				run("farming:set", {
					pid: "0",
					allocPoint: `${poolAllocPoint2}`,
					withUpdate: "true"
				})
			).to.be.revertedWith("Farming::UNKNOWN_POOL");
		});
	});

	describe("pendingReward function: ", function () {
		beforeEach("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		afterEach("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});

		it("PendingReward should equal ExpectedGym: ", async function () {
			await advanceBlockTo(await getBlockNumber());
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});

			const blockToAdvance = 35;
			expect(pid).to.equal(0);

			await testLp.connect(caller).approve(gymFarming.address, amount);
			await testLp.connect(caller).approve(gymFarming.address, amount);
			await testLp.connect(caller).approve(gymFarming.address, amount);
			await testLp.connect(caller).approve(gymFarming.address, amount);
			await testLp.connect(caller).approve(gymFarming.address, amount);
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "false"
			});

			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			let pendingReward = await run("farming:pendingReward", {
				pid: `${pid}`,
				caller: "deployer"
			});

			expect(pendingReward).to.equal(0);

			await advanceBlockTo(startBlock + blockToAdvance);

			pendingReward = await run("farming:pendingReward", {
				pid: `${pid}`,
				caller: "deployer"
			});

			expect(pendingReward).to.equal(
				await run("farming:getMultiplier", {
					from: `${startBlock}`,
					to: `${startBlock + blockToAdvance}`,
					caller: "deployer"
				})
			);

			await run("farming:harvest", {
				pid: `${pid}`
			});

			expect(await gym.balanceOf(caller.address)).to.equal(
				await run("farming:getMultiplier", {
					from: `${startBlock}`,
					to: `${startBlock + blockToAdvance + 1}`,
					caller: "deployer"
				})
			);
		});

		it("PendingReward should equal ExpectedGym (2 signers in 1 pool): ", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});

			const blockToAdvance = 5;
			expect(pid).to.equal(0);

			await testLp.connect(caller).approve(gymFarming.address, amount);
			await testLp.connect(chugun).approve(gymFarming.address, amount);

			await advanceBlockTo(startBlock + blockToAdvance);

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "false"
			});

			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			const log2 = await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`,
				caller: "chugun"
			});

			const pendingRewardCaller = await run("farming:pendingReward", {
				pid: `${pid}`,
				caller: "deployer"
			});
			let pendingRewardChugun = await run("farming:pendingReward", {
				pid: `${pid}`,
				user: "chugun",
				caller: "deployer"
			});

			expect(pendingRewardCaller).to.equal(await gymFarming.rewardPerBlock());
			expect(pendingRewardChugun).to.equal(0);

			let harvesttx = await run("farming:harvest", {
				pid: `${pid}`
			});

			expect(await gym.balanceOf(caller.address)).to.equal(
				pendingRewardCaller.add((await gymFarming.rewardPerBlock()).div(2))
			);

			pendingRewardChugun = await run("farming:pendingReward", {
				pid: `${pid}`,
				user: "chugun",
				caller: "deployer"
			});

			expect(pendingRewardChugun).to.equal((await gymFarming.rewardPerBlock()).div(2));

			harvesttx = await run("farming:harvest", {
				pid: `${pid}`,
				caller: "chugun"
			});

			expect(await gym.balanceOf(chugun.address)).to.equal(
				(
					await run("farming:getMultiplier", {
						from: `${log2.tx.blockNumber}`,
						to: `${harvesttx.tx.blockNumber}`,
						caller: "deployer"
					})
				).div(2)
			);
		});

		it("PendingReward should equal ExpectedGym(4 signers in 2 pools): ", async function () {
			const pid1 = await run("farming:poolLength", {
				caller: "deployer"
			});

			const blockToAdvance = 0;
			expect(pid1).to.equal(0);

			await advanceBlockTo(startBlock + blockToAdvance);

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "false"
			});

			const pid2 = await run("farming:poolLength", {
				caller: "deployer"
			});

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp1.address,
				withUpdate: "true"
			});

			await testLp.connect(caller).approve(gymFarming.address, amount);
			await testLp.connect(chugun).approve(gymFarming.address, amount);
			await testLp.connect(vzgo).approve(gymFarming.address, parseEther("2"));
			await testLp1.connect(vzgo).approve(gymFarming.address, amount);
			await testLp1.connect(grno).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: `${pid1}`,
				amount: `${amount}`
			});
			await run("farming:deposit", {
				pid: `${pid1}`,
				amount: `${amount}`,
				caller: "chugun"
			});

			const log3 = await run("farming:deposit", {
				pid: `${pid1}`,
				amount: `${parseEther("2")}`,
				caller: "vzgo"
			});

			const pendingReward3 = await run("farming:pendingReward", {
				pid: `${pid1}`,
				user: "vzgo",
				caller: "deployer"
			});
			const pendingReward2 = await run("farming:pendingReward", {
				pid: `${pid1}`,
				user: "chugun",
				caller: "deployer"
			});
			const pendingReward1 = await run("farming:pendingReward", {
				pid: `${pid1}`,
				user: "caller",
				caller: "deployer"
			});

			expect(pendingReward3).to.equal(0);
			expect(pendingReward2).to.equal((await gymFarming.rewardPerBlock()).div(4));
			expect(pendingReward1).to.equal((await gymFarming.rewardPerBlock()).div(2).add(pendingReward2));

			await run("farming:deposit", {
				pid: `${pid2}`,
				amount: `${amount}`,
				caller: "vzgo"
			});
			const log5 = await run("farming:deposit", {
				pid: `${pid2}`,
				amount: `${amount}`,
				caller: "grno"
			});

			const pendingReward5 = await run("farming:pendingReward", {
				pid: `${pid2}`,
				user: "grno",
				caller: "deployer"
			});
			const pendingReward4 = await run("farming:pendingReward", {
				pid: `${pid2}`,
				user: "vzgo",
				caller: "deployer"
			});

			expect(pendingReward5).to.equal(0);
			expect(pendingReward4).to.equal((await gymFarming.rewardPerBlock()).div(2));
			let harvesttx = await run("farming:harvest", {
				pid: `${pid1}`
			});

			expect(await gym.balanceOf(caller.address)).to.equal(
				(
					await run("farming:getMultiplier", {
						from: `${log3.tx.blockNumber}`,
						to: `${harvesttx.tx.blockNumber}`,
						caller: "deployer"
					})
				)
					.div(5)
					.add(pendingReward1)
			);

			harvesttx = await run("farming:harvest", {
				pid: `${pid1}`,
				caller: "chugun"
			});

			expect(await gym.balanceOf(chugun.address)).to.equal(
				(
					await run("farming:getMultiplier", {
						from: `${log3.tx.blockNumber}`,
						to: `${harvesttx.tx.blockNumber}`,
						caller: "deployer"
					})
				)
					.div(5)
					.add(pendingReward2)
			);

			harvesttx = await run("farming:harvest", {
				pid: `${pid1}`,
				caller: "vzgo"
			});

			expect(await gym.balanceOf(vzgo.address)).to.equal(
				(
					await run("farming:getMultiplier", {
						from: `${log3.tx.blockNumber}`,
						to: `${harvesttx.tx.blockNumber}`,
						caller: "deployer"
					})
				)
					.div(10)
					.add(pendingReward3)
			);

			const vzgoGym = await gym.balanceOf(vzgo.address);
			harvesttx = await run("farming:harvest", {
				pid: `${pid2}`,
				caller: "vzgo"
			});

			expect((await gym.balanceOf(vzgo.address)).sub(vzgoGym)).to.equal(
				(
					await run("farming:getMultiplier", {
						from: `${log5.tx.blockNumber}`,
						to: `${harvesttx.tx.blockNumber}`,
						caller: "deployer"
					})
				)
					.div(4)
					.add(pendingReward4)
			);

			harvesttx = await run("farming:harvest", {
				pid: `${pid2}`,
				caller: "grno"
			});

			expect(await gym.balanceOf(grno.address)).to.equal(
				(
					await run("farming:getMultiplier", {
						from: `${log5.tx.blockNumber}`,
						to: `${harvesttx.tx.blockNumber}`,
						caller: "deployer"
					})
				)
					.div(4)
					.add(pendingReward5)
			);
		});
	});

	describe("setRewardToken function: ", function () {
		beforeEach("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		afterEach("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});

		it("Should update RewardPoolInfo", async function () {
			await run("farming:setRewardToken", {
				token: tokenA.address
			});

			expect(await gymFarming.rewardToken()).to.equal(tokenA.address);
			expect(await gymFarming.rewardTokenToWBNB(0)).to.equal(tokenA.address);
		});

		it("Should harvest right rewardTokens", async function () {
			await tokenA.connect(deployer).transfer(gymFarming.address, parseEther("100"));

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			await testLp.connect(caller).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: "0",
				amount: `${amount}`
			});
			await run("farming:setRewardToken", {
				token: tokenA.address
			});

			const block = (await gymFarming.poolInfo(0)).lastRewardBlock.add(2).toString();

			await advanceBlockTo(parseInt(block));

			const pending = await run("farming:pendingReward", {
				pid: "0",
				user: "caller",
				caller: "deployer"
			});
			const rewardPerBlock = await gymFarming.rewardPerBlock();

			await expect(() =>
				run("farming:harvest", {
					pid: "0"
				})
			).to.changeTokenBalances(tokenA, [caller], [pending.add(rewardPerBlock)]);
		});
	});

	describe("setRewardPerBlock function", function () {
		before("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		after("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});
		it("Should change rewardPerBlock:", async function () {
			const rewardPerBlock = await gymFarming.rewardPerBlock();

			await advanceBlockTo(startBlock + 15);

			expect(await gymFarming.rewardPerBlock()).to.equal(rewardPerBlock);

			await advanceBlockTo(startBlock + 20);

			await run("farming:setRewardPerBlock", {});

			expect(Math.floor(BigNumber.from(await gymFarming.rewardPerBlock()))).to.equal(
				Math.floor((rewardPerBlock * variables.GymFarming_COEFFICIENT) / 1e12)
			);

			await advanceBlockTo(startBlock + 41);

			await run("farming:setRewardPerBlock", {});

			expect(Math.floor(BigNumber.from(await gymFarming.rewardPerBlock()))).to.equal(
				Math.floor((rewardPerBlock * variables.GymFarming_COEFFICIENT ** 2) / 1e12 ** 2)
			);

			await advanceBlockTo(startBlock + 62);

			await run("farming:setRewardPerBlock", {});

			expect(Math.floor(BigNumber.from(await gymFarming.rewardPerBlock()))).to.equal(
				Math.floor((rewardPerBlock * variables.GymFarming_COEFFICIENT ** 3) / 1e12 ** 3)
			);
			await advanceBlockTo(startBlock + 90);

			await run("farming:setRewardPerBlock", {});

			expect(Math.floor(BigNumber.from(await gymFarming.rewardPerBlock()))).to.equal(
				Math.floor((rewardPerBlock * variables.GymFarming_COEFFICIENT ** 3) / 1e12 ** 3)
			);
		});
	});

	describe("Add function: ", function () {
		before("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});
		after("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});
		it("Should add new pool for deposit: ", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			expect((await gymFarming.poolInfo(pid)).lpToken).to.equal(testLp.address);
			expect((await gymFarming.poolInfo(pid)).allocPoint).to.equal(poolAllocPoint2);
			expect((await gymFarming.poolInfo(pid)).lastRewardBlock).to.equal(startBlock);
			expect((await gymFarming.poolInfo(pid)).accRewardPerShare).to.equal(0);
		});
	});

	describe("Deposit function: ", function () {
		beforeEach("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		afterEach("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});

		it("Should deposit in pool: ", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			const accountLp = await testLp.balanceOf(caller.address);

			await testLp.connect(caller).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			expect(await testLp.balanceOf(caller.address)).to.equal(accountLp.sub(amount));
			expect(await testLp.balanceOf(gymFarming.address)).to.equal(amount);
		});

		it("Should correct transfer token whenn call deposit", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});
			await testLp.connect(caller).approve(gymFarming.address, amount);

			await expect(() =>
				run("farming:deposit", {
					pid: `${pid}`,
					amount: `${amount}`
				})
			)
				.to
				.changeTokenBalance(testLp, gymFarming, amount);
		});

		it("Emit event Deposit", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			await testLp.connect(caller).approve(gymFarming.address, amount);
			expect(
				(
					await run("farming:deposit", {
						pid: `${pid}`,
						amount: `${amount}`
					})
				).tx
			)
				.to.emit(gymFarming, "Deposit")
				.withArgs(caller.address, pid, amount);
		});
	});

	describe("Withdraw function: ", function () {
		beforeEach("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		afterEach("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});

		it("Withdraw lps from pool: ", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			const accountLp = await testLp.balanceOf(caller.address);
			const contractLp = await testLp.balanceOf(gymFarming.address);
			await testLp.connect(caller).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			await advanceBlock();

			await run("farming:withdraw", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			expect((await testLp.balanceOf(caller.address)).toString()).to.equal(accountLp);
			expect((await testLp.balanceOf(gymFarming.address)).toString()).to.equal(contractLp);
		});

		it("Should correct transfer token when call withdraw (caller balance)", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			await testLp.connect(caller).approve(gymFarming.address, amount);

			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			const beforeWithdrawContract = await testLp.balanceOf(gymFarming.address);

			await expect(() =>
				run("farming:withdraw", {
					pid: `${pid}`,
					amount: `${amount}`
				})
			)
				.to
				.changeTokenBalance(testLp, caller, beforeWithdrawContract);
		});

		it("Should correct transfer token when call withdraw (contract balance balance)", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			await testLp.connect(caller).approve(gymFarming.address, amount);

			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			let beforeWithdrawContract = await testLp.balanceOf(gymFarming.address);
			beforeWithdrawContract = beforeWithdrawContract.toBigInt();

			await expect(() =>
				run("farming:withdraw", {
					pid: `${pid}`,
					amount: `${amount}`
				})
			)
				.to
				.changeTokenBalance(testLp, gymFarming, BigNumber.from(-beforeWithdrawContract));
		});

		it("Emit event Withdraw", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});

			await testLp.connect(caller).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			await advanceBlock();
			expect(
				(
					await run("farming:withdraw", {
						pid: `${pid}`,
						amount: `${amount}`
					})
				).tx
			)
				.to.emit(gymFarming, "Withdraw")
				.withArgs(caller.address, pid, amount);
		});

		it("Emit event Harvest", async function () {
			const pid = await run("farming:poolLength", {
				caller: "deployer"
			});

			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "true"
			});
	

			await testLp.connect(caller).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: `${pid}`,
				amount: `${amount}`
			});

			await advanceBlock();
			const pending = await run("farming:pendingReward", {
				pid: `${pid}`,
				user: "caller"
			});

			expect(
				(
					await run("farming:withdraw", {
						pid: `${pid}`,
						amount: `${amount}`
					})
				).tx
			)
				.to.emit(gymFarming, "Harvest")
				.withArgs(caller.address, pid, pending);
		});
	});

	describe("HarvestAll function: ", function () {
		before(async function () {
			await run("farming:add", {
				allocPoint: `${poolAllocPoint2}`,
				lpToken: testLp.address,
				withUpdate: "false"
			});
			await run("farming:add", {
				allocPoint: `${poolAllocPoint1}`,
				lpToken: testLp1.address,
				withUpdate: "true"
			});
		});
		beforeEach("Before: ", async function () {
			snapshotStart = await network.provider.request({
				method: "evm_snapshot",
				params: []
			});
		});

		afterEach("After tests: ", async function () {
			await network.provider.request({
				method: "evm_revert",
				params: [snapshotStart]
			});
		});

		it("Should HarvestAll: Call HarvestAll function to get all assets at ones ", async function () {
			await testLp.connect(vzgo).approve(gymFarming.address, amount);
			await testLp1.connect(vzgo).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: "0",
				amount: `${amount}`,
				caller: "vzgo"
			});

			expect((await gymFarming.poolInfo(0)).lastRewardBlock).to.equal(startBlock);
			await run("farming:deposit", {
				pid: "1",
				amount: `${amount}`,
				caller: "vzgo"
			});

			expect((await gymFarming.poolInfo(0)).lastRewardBlock).to.equal(startBlock);
			const block = (await gymFarming.poolInfo(0)).lastRewardBlock.add(10).toString();
			await advanceBlockTo(parseInt(block));
			await run("farming:harvestAll", {
				caller: "vzgo"
			});

			expect((await gymFarming.userInfo(0, vzgo.address)).rewardDebt).to.not.equal(constants.Zero);
			expect((await gymFarming.userInfo(1, vzgo.address)).rewardDebt).to.not.equal(constants.Zero);
		});

		it("Emit Harvest event", async function () {
			await testLp.connect(vzgo).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: "0",
				amount: `${amount}`,
				caller: "vzgo"
			});

			const pending = await run("farming:pendingReward", {
				pid: "0",
				user: "vzgo",
				caller: "deployer"
			});

			expect(
				(
					await run("farming:harvest", {
						pid: "0",
						caller: "vzgo"
					})
				).tx
			)
				.to.emit(gymFarming, "Harvest")
				.withArgs(vzgo.address, 0, pending);
		});

		it("Should correct transfer when call harvest function", async function () {
			await testLp.connect(vzgo).approve(gymFarming.address, amount);
			await run("farming:deposit", {
				pid: "0",
				amount: `${amount}`,
				caller: "vzgo"
			});
			const pending = await gymFarming.pendingReward(0, vzgo.address);

			await expect(() =>
				gymFarming.connect(vzgo).harvest(0)
			)
				.to
				.changeTokenBalance(testLp, vzgo, pending);
		});
	});
});

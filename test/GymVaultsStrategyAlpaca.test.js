const {
    expect
} = require("chai");
const {
    deployments,
    network,
    ethers
} = require("hardhat");
const {
    getContract,
    getNamedSigners
} = ethers;
const {
    VARIABLES
} = require("../helpers")

let accounts;
const variables = VARIABLES.hardhat


describe("GymVaultsStrategyAlpaca contract: ", function () {
    before("Before All: ", async () => {
        accounts = await getNamedSigners();
        await hre.run("deployMocks");

        await deployments.deploy("GymToken", {
            from: accounts.deployer.address,
            args: [accounts.holder.address],
            deterministicDeployment: true
        })

        this.router = await getContract("RouterMock")
        this.farm = await getContract("FarmMock")
        this.vault = await getContract("VaultMock")
        this.fairLaunch = await getContract("FairLaunchMock")
        this.bank = await getContract("BankMock", accounts.caller);
        this.gymToken = await getContract("GymToken", accounts.caller);
        this.want = await getContract("WantToken1", accounts.caller);
        this.earn = await getContract("EarnToken", accounts.caller);
        this.tokenA = await getContract("TokenA", accounts.caller);
        this.ibToken = await getContract("ibToken", accounts.caller);
        // this.tokenB = await getContract("TokenB", accounts.caller);
        await deployments.deploy("GymVaultsStrategyAlpaca", {
            from: accounts.deployer.address,
            args: [
                this.bank.address,
                false,
                this.vault.address,
                this.fairLaunch.address,
                0, // pid
                this.want.address,
                this.earn.address,
                this.router.address
            ],
            log: true,
            deterministicDeployment: false
        })

        this.strategyAlpaca = await getContract("GymVaultsStrategyAlpaca", accounts.caller);

        await deployments.deploy("GymVaultsStrategyAlpaca", {
            from: accounts.deployer.address,
            args: [
                this.bank.address,
                true,
                this.vault.address,
                this.fairLaunch.address,
                0, // pid
                this.want.address,
                this.earn.address,
                this.router.address
            ],
            log: true,
            deterministicDeployment: false
        })

        this.strategyAlpacaAutoComp = await getContract("GymVaultsStrategyAlpaca", accounts.caller);

        await this.want.connect(accounts.deployer).transfer(this.bank.address, variables.TEST_TOKENS_MINT_AMOUNT / 4)
        await this.want.connect(accounts.deployer).transfer(this.router.address, variables.TEST_TOKENS_MINT_AMOUNT / 4)
        await this.want.connect(accounts.deployer).transfer(this.farm.address, variables.TEST_TOKENS_MINT_AMOUNT / 4)
        await this.want.connect(accounts.deployer).transfer(accounts.vzgo.address, variables.TEST_TOKENS_MINT_AMOUNT / 8)
        await this.earn.connect(accounts.deployer).transfer(this.farm.address, variables.TEST_TOKENS_MINT_AMOUNT / 2)
        await this.earn.connect(accounts.deployer).transfer(this.fairLaunch.address, variables.TEST_TOKENS_MINT_AMOUNT / 4)
        await this.ibToken.connect(accounts.deployer).transfer(this.vault.address, variables.TEST_TOKENS_MINT_AMOUNT / 2)
        await this.gymToken.connect(accounts.holder).transfer(this.router.address, variables.TEST_TOKENS_MINT_AMOUNT)
        // await this.tokenA.connect(accounts.deployer).transfer(accounts.vzgo.address, variables.TOKENS_MINT_AMOUNT / 2)
        // await this.tokenB.connect(accounts.deployer).transfer(this.router.address, variables.TOKENS_MINT_AMOUNT / 2)
        console.log(await this.want.balanceOf(this.bank.address));
    })

    describe("Constructor: ", async () => {
        it("Should get the correct arguments after the constructor's work for first strategy: ", async () => {
            expect(await this.strategyAlpaca.operator()).to.equal(accounts.deployer.address);
            expect(await this.strategyAlpaca.strategist()).to.equal(accounts.deployer.address);
            expect(await this.strategyAlpaca.wantAddress()).to.equal(this.want.address);
            expect(await this.strategyAlpaca.owner()).to.equal(this.bank.address);
            expect(await this.strategyAlpaca.isAutoComp()).to.equal(false);
        })
    })

    describe("isAuthorised function: ", async () => {
        it("Should return true if account is operator or strategist: ", async () => {
            expect(await this.strategyAlpaca.isAuthorised(accounts.deployer.address)).to.equal(true)
        })

        it("Should return false if account is not operator or strategist: ", async () => {
            expect(await this.strategyAlpaca.isAuthorised(accounts.owner.address)).to.equal(false)
            expect(await this.strategyAlpaca.isAuthorised(accounts.holder.address)).to.equal(false)
            expect(await this.strategyAlpaca.isAuthorised(this.farm.address)).to.equal(false)
        })
    })

    describe("Deposit function: ", async () => {
        before("Before: ", async () => {
            this.snapshotStart = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        })

        after("After tests: ", async () => {
            await network.provider.request({
                method: "evm_revert",
                params: [this.snapshotStart]
            });
        })

        it("Should receive first deposit from user: ", async () => {
            await this.bank.deposit(this.strategyAlpaca.address, variables.TEST_TX_AMOUNT)
            expect(await this.want.balanceOf(this.strategyAlpaca.address)).to.equal(variables.TEST_TX_AMOUNT)
            expect(await this.strategyAlpaca.wantLockedTotal()).to.equal(variables.TEST_TX_AMOUNT)
            expect(await this.strategyAlpaca.sharesTotal()).to.equal(variables.TEST_TX_AMOUNT)
        })

        it("Should receive second deposit from user: ", async () => {
            await this.bank.deposit(this.strategyAlpaca.address, variables.TEST_TX_AMOUNT * 2)

            expect(await this.want.balanceOf(this.strategyAlpaca.address)).to.equal(variables.TEST_TX_AMOUNT * 3)
            expect(await this.strategyAlpaca.wantLockedTotal()).to.equal(variables.TEST_TX_AMOUNT * 3)
            expect(await this.strategyAlpaca.sharesTotal()).to.equal(variables.TEST_TX_AMOUNT * 3)
            expect(await this.strategyAlpaca.sharesTotal()).to.equal(variables.TEST_TX_AMOUNT * 3)

        })
    })

    describe("Farm function: ", async () => {
        beforeEach("Before: ", async () => {
            this.snapshotStart = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        })

        afterEach("After tests: ", async () => {
            await network.provider.request({
                method: "evm_revert",
                params: [this.snapshotStart]
            });
        })

        it("Should stake token for farming: ", async () => {
            let farmBalBefore = await this.want.balanceOf(this.vault.address)

            await this.bank.deposit(this.strategyAlpacaAutoComp.address, variables.TEST_TX_AMOUNT)

            expect(await this.want.balanceOf(this.vault.address)).to.equal(Number(farmBalBefore) + variables.TEST_TX_AMOUNT)
            expect(await this.strategyAlpacaAutoComp.wantLockedTotal()).to.equal(variables.TEST_TX_AMOUNT)
        })
    })

    describe("Withdraw function: ", async () => {
        beforeEach("Before: ", async () => {
            this.snapshotStart = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        })

        afterEach("After tests: ", async () => {
            await network.provider.request({
                method: "evm_revert",
                params: [this.snapshotStart]
            });
        })

        it("Should revert with 'GymVaultsStrategy: !_wantAmt': ", async () => {
            await this.bank.deposit(this.strategyAlpaca.address, variables.TEST_TX_AMOUNT)

            await expect(this.bank.withdraw(this.strategyAlpaca.address, 0)).to.be.revertedWith('GymVaultsStrategyAlpaca: !_wantAmt')
        })

        it("Should withdraw tokens(isAutoComp): ", async () => {
            withdrawAmount = variables.TEST_TX_AMOUNT / 4

            await this.bank.deposit(this.strategyAlpacaAutoComp.address, variables.TEST_TX_AMOUNT)


            let fairLaunchBefore = await this.vault.balanceOf(this.fairLaunch.address)
            let wantBalBefore = await this.want.balanceOf(this.vault.address)
            let bankBalBefore = await this.want.balanceOf(this.bank.address)
            let wantLockedTotalBefore = await this.strategyAlpacaAutoComp.wantLockedTotal()
            let sharesTotalBefore = await this.strategyAlpacaAutoComp.sharesTotal()

            await this.bank.withdraw(this.strategyAlpacaAutoComp.address, withdrawAmount)

            let sharesTotalAfter = sharesTotalBefore - (withdrawAmount * sharesTotalBefore / wantLockedTotalBefore)

            expect(await this.vault.balanceOf(this.fairLaunch.address)).to.equal(fairLaunchBefore - withdrawAmount)
            expect((await this.want.balanceOf(this.bank.address)) - bankBalBefore).to.equal(withdrawAmount)
            expect(await this.want.balanceOf(this.vault.address)).to.equal(wantBalBefore - withdrawAmount)
            expect(await this.strategyAlpacaAutoComp.wantLockedTotal()).to.equal(wantLockedTotalBefore - withdrawAmount)
            expect(await this.strategyAlpacaAutoComp.sharesTotal()).to.equal(sharesTotalAfter)
        })

        it("Should withdraw tokens(!isAutoComp): ", async () => {
            withdrawAmount = variables.TEST_TX_AMOUNT / 4

            await this.bank.deposit(this.strategyAlpaca.address, variables.TEST_TX_AMOUNT)

            let wantLockedTotalBefore = await this.strategyAlpaca.wantLockedTotal()
            let bankBalBefore = await this.want.balanceOf(this.bank.address)
            let sharesTotalBefore = await this.strategyAlpaca.sharesTotal()

            await this.bank.withdraw(this.strategyAlpaca.address, withdrawAmount)

            expect(await this.want.balanceOf(this.bank.address)).to.equal(Number(bankBalBefore) + withdrawAmount)
            expect(await this.strategyAlpaca.wantLockedTotal()).to.equal(wantLockedTotalBefore - withdrawAmount)
            expect(await this.strategyAlpaca.sharesTotal()).to.equal(sharesTotalBefore - withdrawAmount)
        })
    })

    describe("DistributeFees function: ", async () => {
        before("Before: ", async () => {
            this.snapshotStart = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        })

        after("After tests: ", async () => {
            await network.provider.request({
                method: "evm_revert",
                params: [this.snapshotStart]
            });
        })

        it("Should distribute earned tokens: ", async () => {
            const feeMax = await this.strategyAlpacaAutoComp.controllerFeeMax();

            await this.bank.deposit(this.strategyAlpacaAutoComp.address, variables.TEST_TX_AMOUNT)

            let deployerEarnBal = Number(await this.earn.balanceOf(accounts.deployer.address))

            await this.strategyAlpacaAutoComp.connect(accounts.deployer).setControllerFee(variables.TEST_FEE)

            await this.strategyAlpacaAutoComp.earn(0, new Date().getTime() + 20)

            fairLaunchWantBal = Number(await this.vault.balanceOf(this.fairLaunch.address))

            expect(await this.earn.balanceOf(accounts.deployer.address)).to.equal(deployerEarnBal + variables.TEST_FAIR_LAUNCH_RETURN_AMOUNT * variables.TEST_FEE / feeMax)
        })
    })

    describe("Earn function: ", async () => {
        beforeEach("Before: ", async () => {
            this.snapshotStart = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        })

        afterEach("After tests: ", async () => {
            await network.provider.request({
                method: "evm_revert",
                params: [this.snapshotStart]
            });
        })

        it("Should revert with 'GymVaultsStrategyAlpaca: !isAutoComp': ", async () => {
            await expect(this.strategyAlpaca.earn(0, new Date().getTime() + 20)).to.be.revertedWith("GymVaultsStrategyAlpaca: !isAutoComp")
        })

        it("Should revert with 'GymVaultsStrategyAlpaca: !authorised': ", async () => {
            await this.strategyAlpacaAutoComp.connect(accounts.deployer).setNotPublic(true)
            await expect(this.strategyAlpacaAutoComp.connect(accounts.vzgo).earn(0, new Date().getTime() + 20)).to.be.revertedWith("GymVaultsStrategyAlpaca: !authorised")
        })

        it("Should leave staking and call farm again: ", async () => {
            await this.bank.deposit(this.strategyAlpacaAutoComp.address, variables.TEST_TX_AMOUNT)

            let vaultBalBefore = await this.want.balanceOf(this.vault.address)

            let tx = await this.strategyAlpacaAutoComp.earn(0, new Date().getTime() + 20)

            expect(await this.strategyAlpacaAutoComp.lastEarnBlock()).to.equal(tx.blockNumber)
            expect(await this.want.balanceOf(this.vault.address)).to.equal(Number(vaultBalBefore) + variables.TEST_FAIR_LAUNCH_RETURN_AMOUNT)
        })
    })

    describe("convertDustToEarned function: ", async () => {
        beforeEach("Before: ", async () => {
            this.snapshotStart = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        })

        afterEach("After tests: ", async () => {
            await network.provider.request({
                method: "evm_revert",
                params: [this.snapshotStart]
            });
        })

        it("Should revert with 'GymVaultsStrategyAlpaca: !isAutoComp': ", async () => {
            await expect(this.strategyAlpaca.convertDustToEarned(0, new Date().getTime() + 20)).to.be.revertedWith("GymVaultsStrategyAlpaca: !isAutoComp")
        })

        it("Should convert dust tokens into earned tokens: ", async () => {
            await this.want.connect(accounts.deployer).transfer(this.strategyAlpacaAutoComp.address, variables.TEST_TX_AMOUNT)
            await this.earn.connect(accounts.deployer).transfer(this.router.address, variables.TEST_TX_AMOUNT)

            await this.strategyAlpacaAutoComp.convertDustToEarned(0, new Date().getTime() + 20);

            expect(await this.earn.balanceOf(this.strategyAlpacaAutoComp.address)).to.equal(variables.TEST_TX_AMOUNT)
        })
    })

})
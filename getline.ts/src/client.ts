import {BigNumber} from 'bignumber.js';
import * as moment from 'moment';

import {MetabackendClient, MetabackendService, pb} from './metabackend';
import {GetlineBlockchain, Blockchain} from './blockchain';
import {Loan} from './loan';
import {Address, Token, LOAN_CONTRACT} from './common';

/**
 * Getline client library.
 *
 * This library lets you view and manage Getline.in loans programatically.
 * It runs under node.js and in Chrome with the Metamask extension. You will
 * be automatically logged in as the first address from your web3 provider.
 *
 * The library is fully async/await compatible, which means you can use it
 * both with `Promise.then/.catch` and `await` blocks. All calls that interact
 * with the blockchain will block until the result propagates.
 *
 * Currently this library **only allows you to create loans on the Rinkeby
 * testnet** - this is by design until we go out of demo.
 *
 */
export class Client {
    private metabackend: MetabackendClient;
    private network: string;
    private blockchain: GetlineBlockchain;

    /**
     * Token that is used for collateral and loans in the demo.
     */
    public test_token: Token;

    /**
     * Creates a new Getline client.
     *
     * @param metabackend Address of metabackend. Production address is
     *                    `https://0.api.getline.in`.
     * @param network Network identifier. Currently only `"4"` (Rinkeby) is
     *                supported.
     */
    constructor(metabackend: string, network: string) {
        this.metabackend = new MetabackendClient(metabackend, network);
        this.network = network;
        this.blockchain = new GetlineBlockchain(this.metabackend, network);
        this.test_token = new Token(this.blockchain, "0x02c9ccaa1034a64e3a83df9ddce30e6d4bc40515");
    }

    public async currentUser(): Promise<Address> {
        return this.blockchain.coinbase();
    }

    /**
     * Creates a new Getline Loan on the blockchain and indexes it in the
     * Getline system.
     *
     * Currently these loans use `TEST_TOKEN` as both the collateral and loan
     * token. This will be changed in the future.
     *
     * @param description Human-readable description of loan. Markdown.
     * @param amount Amount of loan requested.
     * @param interestPermil Loan interest in permil.
     * @param fundraisingDelta Number of seconds from loan creation until
     *                         fundraising ends.
     * @param paybackDelta Number of seconds from loan creation until loan
     *                     must be paid back. This cannot be earlier than
     *                     `fundraisingDelta`.
     * @returns Newly created loan.
     */
    public async newLoan(description: string, amount: BigNumber, interestPermil: number,
                         fundraisingEnd: moment.Moment, paybackEnd: moment.Moment): Promise<Loan> {
        // TODO(q3k) change this when we're not on rinkeby and we have a better loan SC
        if (this.network != "4") {
            throw new Error("cannot place loan on non-rinkeby chains");
        }

        let now = moment();
        if (fundraisingEnd.isBefore(now)) {
            throw new Error("cannot place loan with fundraising deadline in the past");
        }
        if (paybackEnd.isBefore(now)) {
            throw new Error("cannot place loan with payback deadline in the past");
        }
        if (paybackEnd.isBefore(fundraisingEnd)) {
            throw new Error("cannot place loan with payback deadline before fundraising deadline");
        }

        let currentBlock = (await this.blockchain.currentBlock()).toNumber();
        let blocksPerSecond = (1.0) / 15;

        let fundraisingDelta = fundraisingEnd.diff(now, 'seconds');
        let paybackDelta = paybackEnd.diff(now, 'seconds');
        let fundraisingEndBlocks = currentBlock + blocksPerSecond * fundraisingDelta;
        let paybackEndBlocks = currentBlock + blocksPerSecond * paybackDelta;

        let loan = await this.blockchain.deploy(LOAN_CONTRACT,
            this.test_token.ascii, this.test_token.ascii,
            (await this.currentUser()).ascii,
            amount, interestPermil, fundraisingEndBlocks, paybackEndBlocks);

        let req = new pb.IndexLoanRequest();
        req.setNetworkId(this.network);
        req.setDescription(description);
        req.setLoan(loan.address.proto());

        let res = await this.metabackend.invoke(MetabackendService.IndexLoan, req);
        console.log("getline.ts: indexed loan as " + res.getShortId());
        return this.loan(res.getShortId());
    }

    /**
     * Returns loan identifier by a given short identifier.
     *
     * @param shortId Short identifier of loan (`shortId` member of a `Loan`
     *                object).
     * @returns Loan identifier by shortId.
     */
    public async loan(shortId: string): Promise<Loan> {
        let req = new pb.GetLoansRequest();
        req.setNetworkId(this.network);
        req.setShortId(shortId);

        let res = await this.metabackend.invoke(MetabackendService.GetLoans, req);
        if (res.getNetworkId() != this.network) {
            throw new Error("Invalid network ID in response.");
        }

        let loan = new Loan(this.blockchain);
        await loan.loadFromProto(res.getLoanCacheList()[0]);
        return loan;
    }

    /**
     * Returns all loans owned by a given address, regardless of their state.
     *
     * @param owner Ethereum address of owner/liege.
     * @returns Loans owned by `owner`.
     */
    public async loansByOwner(owner: Address): Promise<Array<Loan>> {
        let req = new pb.GetLoansRequest();
        req.setNetworkId(this.network);
        req.setOwner(owner.proto());

        let res = await this.metabackend.invoke(MetabackendService.GetLoans, req);
        if (res.getNetworkId() != this.network) {
            throw new Error("Invalid network ID in response.");
        }

        let loans : Array<Loan> = [];
        let promises : Array<Promise<void>> = [];
        let currentBlock = await this.blockchain.currentBlock();
        res.getLoanCacheList().forEach((elem) => {
            let loan = new Loan(this.blockchain);
            promises.push(loan.loadFromProto(elem));
            loans.push(loan);
        });
        await Promise.all(promises);
        return loans;
    }
}

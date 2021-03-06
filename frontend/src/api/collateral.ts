import { BigNumber } from "bignumber.js";

import API, { Loan } from './index';

export async function gatherCollateral(shortId: string, amount) {
  const api = await API.instance();
  const token = api.testToken;
  const user = await api.currentUser();
  const loan = await api.loan(shortId);
  await loan.sendCollateral(new BigNumber(amount));
}
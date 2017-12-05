import actions from './actions';
import { mutations } from './mutations';
import { InvestStateT } from './types';

const state: InvestStateT = {
  loansToInvest: [],
  isLoading: false,
}

export default {
  state,
  actions,
  mutations,
};

export { LoanToInvestT } from './types';
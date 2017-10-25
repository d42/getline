import Vue from 'vue';
import Router from 'vue-router';
import RequestLoan from '@/components/RequestLoan';
import InvestBar from '@/components/Invest/InvestBar';
import LoanList from '@/components/Invest/LoanList/LoanList';
import MyInvestments from '@/components/Invest/MyInvestments';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/borrow',
      component: RequestLoan,
    },
    {
      path: '/invest',
      component: InvestBar,
      children: [
        {
          path: '', redirect: '/invest/loan-list',
        },
        {
          path: 'loan-list',
          component: LoanList,
        },
        {
          path: 'my-investments',
          component: MyInvestments,
        },
      ],
    },
  ],
});

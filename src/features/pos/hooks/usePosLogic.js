import { useState, useMemo, useCallback } from 'react';

export function usePosLogic({ order, total, vatRate, settings }) {
  const [discountType, setDiscountType] = useState('none');
  const [discountVal, setDiscountVal] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsDiscount, setPointsDiscount] = useState(0);
  const [orderType, setOrderType] = useState('counter');
  const [orderNote, setOrderNote] = useState('');
  const [payments, setPayments] = useState([{ type: 'Cash', amount: '' }]);
  const [invoiceType, setInvoiceType] = useState('simplified');
  const [isSplit, setIsSplit] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const calculatePointsDiscount = useCallback((customer) => {
    if (customer && (customer.loyalty_points || 0) > 0) {
      const rate = parseFloat(settings?.loyalty_redeem_rate || 0.1);
      setPointsDiscount(Math.floor((customer.loyalty_points || 0) * rate));
    } else {
      setPointsDiscount(0);
      setRedeemPoints(false);
    }
  }, [settings?.loyalty_redeem_rate]);

  const handleSetCustomer = useCallback((customer) => {
    setSelectedCustomer(customer);
    calculatePointsDiscount(customer);
  }, [calculatePointsDiscount]);

  const finalTotal = useMemo(() => {
    let t = total;
    if (discountType === 'final') {
      const finalVal = parseFloat(discountVal);
      if (!isNaN(finalVal) && finalVal >= 0 && discountVal !== '') {
        t = finalVal;
      }
    } else {
      if (discountType === 'pct') t -= (total * (parseFloat(discountVal) || 0) / 100);
      else if (discountType === 'fixed') t -= (parseFloat(discountVal) || 0);
    }
    if (redeemPoints) t -= pointsDiscount;
    return Math.max(0, t);
  }, [total, discountType, discountVal, redeemPoints, pointsDiscount]);

  const paidTotal = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = Math.max(0, finalTotal - paidTotal);
  const changeAmt = Math.max(0, paidTotal - finalTotal);
  const canFinalize = finalTotal >= 0 && remaining <= 0.005 && order.length > 0;

  const resetState = useCallback(() => {
    setSelectedCustomer(null);
    setOrderNote('');
    setDiscountVal('');
    setDiscountType('none');
    setPayments([{ type: 'Cash', amount: '' }]);
    setRedeemPoints(false);
    setIsSplit(false);
    setInvoiceType('simplified');
  }, []);

  return {
    discountType, setDiscountType,
    discountVal, setDiscountVal,
    redeemPoints, setRedeemPoints,
    pointsDiscount,
    orderType, setOrderType,
    orderNote, setOrderNote,
    payments, setPayments,
    invoiceType, setInvoiceType,
    isSplit, setIsSplit,
    selectedCustomer, setSelectedCustomer: handleSetCustomer,
    finalTotal, paidTotal, remaining, changeAmt, canFinalize,
    resetState
  };
}

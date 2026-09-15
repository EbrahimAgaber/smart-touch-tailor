# Maulam User Journeys & Scenarios (100 Cases)

This document contains 100 hypothetical scenarios that a Maulam (tailor/manager) might face in the shop. Our development method requires us to test and fully implement Scenario N before moving to Scenario N+1.

## Category 1: Basic Walk-In & Ordering
1. **New Customer, Standard Thobe:** A new customer walks in and wants a single standard white thobe using shop fabric. Full payment upfront.
2. **Returning Customer, New Order:** A returning customer wants to order a new thobe using their exact measurements from last year.
3. **Multiple Thobes, Same Size:** A customer orders 4 identical thobes with the same measurements and fabric.
4. **Bring Your Own Fabric (BYOF):** A customer brings their own fabric for 2 thobes. The Maulam only charges for tailoring/labor.
5. **Urgent Order:** A customer needs a thobe in 24 hours. An urgent fee is applied.
6. **Gift Order:** A customer pays for a thobe for someone else. The measurements will be taken later when the recipient visits.
7. **Draft Order:** Customer selects fabric and style but realizes they forgot their wallet. The order is saved as a draft.
8. **Quote/Estimate:** Customer asks for a price estimate for 5 thobes of a premium fabric, printed but not finalized.
9. **Seasonal Discount:** Applying a 15% Ramadan discount to the total bill.
10. **Custom Embroidery:** Ordering a thobe with specific custom embroidery on the chest and cuffs (extra charge).

## Category 2: Measurements & Profiles
11. **New Complex Profile:** A new customer has uneven shoulders, requiring specific measurement notes and asymmetrical tailoring instructions.
12. **Updating Existing Profile:** A returning customer has gained weight; their chest and waist measurements need updating before a new order.
13. **Child Measurements:** Creating a profile for a child whose measurements change rapidly (date-stamping measurements is critical).
14. **Temporary Alteration Note:** Customer wants this specific thobe 1 inch shorter than their standard profile, without permanently changing their profile.
15. **Measurement History Comparison:** The Maulam wants to see the last 3 measurements for a customer to verify a sudden change in collar size.
16. **Incomplete Measurements:** The Maulam starts taking measurements, but gets interrupted. The profile is saved as "incomplete" to be finished later.
17. **Duplicate Customer Merge:** Two profiles exist for the same phone number. The Maulam needs to merge them and keep the latest measurements.
18. **Photo Reference Attachment:** Uploading/attaching a photo of a specific collar style the customer requested to their measurement profile.
19. **Unit Toggle:** The Maulam accidentally measures in CM instead of Inches and needs the system to auto-convert or toggle.
20. **Sharing Profile:** Exporting or sharing a customer's measurements as a PDF to send to an external workshop.

## Category 3: Payments & Invoicing (ZATCA)
21. **Standard Partial Payment:** Total is 500 SAR. Customer pays 200 SAR upfront in Cash, 300 SAR pending upon delivery.
22. **Multi-Tender Payment:** Customer pays a 400 SAR bill using 100 SAR Cash and 300 SAR Mada (Card).
23. **Delayed Deposit:** Customer places order over the phone and sends the deposit via Bank Transfer an hour later. The Maulam updates the payment status.
24. **ZATCA B2C Invoice Generation:** Generating a standard simplified tax invoice with QR code for a walk-in consumer.
25. **ZATCA B2B Invoice Generation:** Generating a detailed tax invoice for a corporate client (e.g., uniforms for a hotel) requiring VAT numbers.
26. **Refunding an Uncut Order:** Customer cancels an order before cutting. Full cash refund and generation of a Credit Note.
27. **Refunding a Cut Order:** Customer cancels, but fabric is cut. Partial refund (keeping fabric cost), issuing a proper Credit Note.
28. **Overpayment:** Customer accidentally transfers 600 SAR instead of 500 SAR. The Maulam adds 100 SAR as store credit to their account.
29. **Store Credit Payment:** Customer uses their 100 SAR store credit and pays the remaining 400 SAR via Card.
30. **Invoice Re-printing:** Customer lost their receipt and needs a duplicate printed for pickup.

## Category 4: Workflow, Cutting & Tailoring
31. **Assigning to Master Cutter:** The Maulam assigns Order #1001 to "Cutter Ahmed" and prints a cutting ticket.
32. **Fabric Out of Stock Alert:** The system alerts the Maulam that the requested fabric roll only has 2 meters left (not enough for a thobe).
33. **Status Update - Cutting:** Updating the order status from "Pending" to "In Cutting".
34. **Status Update - Tailoring:** Updating the order status from "In Cutting" to "In Tailoring".
35. **Status Update - Ready:** Order is finished and ironed. Status changed to "Ready for Pickup". Auto-SMS sent to the customer.
36. **Batch Status Update:** 10 thobes from the workshop just arrived. The Maulam scans them to bulk-update their status to "Ready".
37. **External Workshop Delegation:** An order is too complex, so it's marked as "Sent to External Workshop" with a tracking date.
38. **Quality Control Failure:** A finished thobe fails QC (e.g., wrong button color). It is sent back to tailoring with a defect note.
39. **Workshop Deadline Warning:** The dashboard flags an order that is due tomorrow but is still in the "Cutting" phase.
40. **Tailor Productivity Report:** The Maulam checks how many thobes "Tailor Faisal" completed this week.

## Category 5: Modifications & After-Sales
41. **Free Alteration (Shop Fault):** Customer picks up the thobe, tries it on, and the sleeves are too long due to a tailor error. An internal alteration ticket is made at zero cost.
42. **Paid Alteration (Customer Request):** Customer brings a thobe from 6 months ago to make it tighter. A new alteration ticket is made with a 50 SAR fee.
43. **External Alteration:** Customer brings a thobe bought elsewhere for hemming.
44. **Tracking Alteration Status:** Just like a new order, the alteration needs to go through "Tailoring" and "Ready" statuses.
45. **Alteration History:** Viewing how many times a specific order has been altered to identify recurring fitting issues.
46. **Lost Alteration Ticket:** Customer lost their alteration pickup slip. Maulam searches by phone number to find it.
47. **Unclaimed Alteration:** An altered thobe has been sitting on the rack for 3 months. System flags it for follow-up.
48. **Destroyed Garment Compensation:** A tailor accidentally burns a customer's thobe while ironing. The Maulam processes a replacement order at no cost.
49. **Post-Pickup Defect:** Customer returns 2 days later because a button fell off. Instant fix, but needs to be logged for QC tracking.
50. **Satisfaction Feedback:** Sending an automated survey to the customer 2 days after pickup.

## Category 6: Inventory & Supplies
51. **Receiving New Fabric Roll:** Adding a new 50-meter roll of Japanese Cotton (SKU: JC-White-01) to the system.
52. **Deducting Fabric for Order:** Automatically deducting 3.5 meters of JC-White-01 when an order is moved to "Cutting".
53. **Manual Inventory Adjustment:** The Maulam measures a roll and finds it has 40 meters, but the system says 42. A manual shrinkage/waste adjustment is made.
54. **Low Stock Threshold Alert:** A popular fabric drops below 15 meters. The system highlights it for reordering.
55. **Accessories Stock:** Adding stock for 500 white buttons and 200 zippers.
56. **Supplier Purchase Order:** Creating a PO for the textile supplier to order 10 more rolls.
57. **Damaged Fabric Logging:** 2 meters of a roll are stained and unusable. It is written off as damaged inventory.
58. **Stock Take / Audit:** End-of-month physical inventory count vs system count discrepancy report.
59. **Multi-Branch Transfer:** Transferring 1 roll of fabric from the Main Branch to the Secondary Branch.
60. **Cost Price Update:** A supplier raises prices; the Maulam updates the cost per meter for future profit calculations.

## Category 7: Customers & CRM
61. **VIP Customer Tag:** Tagging a high-spending customer as "VIP" to automatically apply a 10% discount on all future orders.
62. **Blacklisting a Customer:** Flagging a customer who consistently refuses to pay or causes trouble.
63. **Birthday Promotion SMS:** System automatically sends a discount code to a customer on their birthday.
64. **Dormant Customer Reactivation:** Identifying customers who haven't ordered in 2 years and sending a win-back SMS.
65. **Customer Debt Report:** Viewing a list of all customers who owe the shop money for completed orders.
66. **Family Accounts:** Linking a father's account with his 3 sons so the father can pay for all their orders simultaneously.
67. **Corporate Account Statement:** Generating a monthly statement for a hotel showing all employee uniforms tailored.
68. **Address/Delivery Details:** Adding a customer's shipping address for a home delivery order.
69. **Communication Log:** Checking if the "Your order is ready" SMS was actually delivered to the customer.
70. **Referral Tracking:** A new customer says "Ahmed sent me". Linking them to Ahmed to give Ahmed a referral discount.

## Category 8: Advanced Edge Cases (The Real World)
71. **Power Outage During Payment:** The card machine approves, but the POS app crashes before saving. The Maulam needs to reconcile the transaction on reboot.
72. **Network Offline Mode:** The internet goes down. The Maulam needs to take an order offline and sync it to the cloud later (including ZATCA offline limits).
73. **Customer Changes Mind Mid-Tailoring:** Thobe is already cut, but customer calls to change collar type. The Maulam must check if the cut piece can accommodate the change and update the tailor.
74. **Splitting a Payment Across 3 Methods:** 100 Cash, 200 Card, 200 Bank Transfer for a single 500 SAR order.
75. **Wrong Fabric Cut:** Tailor cuts the blue fabric instead of the black fabric. Maulam must void the cut, deduct from the blue roll, deduct from the black roll, and restart.
76. **Customer Refuses Final Product:** Thobe is made exactly to spec, but customer hates how it looks and refuses to pay the balance.
77. **Typo in Price:** Maulam accidentally typed 50 SAR instead of 500 SAR, and the customer already paid. Need to void/credit note and re-issue correctly.
78. **System Clock Tampering:** A worker tries to change the PC time to bypass a restriction. POS must rely on a secure timestamp.
79. **Tax Rate Change:** The government changes VAT from 15% to 20% overnight. Open orders must handle the transition correctly depending on the invoice date.
80. **Hardware Disconnect:** The receipt printer runs out of paper mid-print. The system must allow a seamless reprint once paper is loaded.

## Category 9: Employee & Shift Management
81. **Opening the Register:** Maulam starts the morning shift with a 500 SAR cash float in the drawer.
82. **Closing the Register (Z-Report):** End of shift summary showing expected cash vs actual cash.
83. **Cash Drop/Payout:** Maulam takes 200 SAR from the till to pay for shop cleaning supplies and logs it as an expense.
84. **Employee Login/PIN:** Tailor Faisal logs into the POS using a 4-digit PIN to check his assigned tasks.
85. **Permission Denial:** A junior clerk tries to issue a refund, but the system prompts for the Manager's override PIN.
86. **Time Clock:** Employees clocking in and out of their shift via the POS app.
87. **Commission Tracking:** Calculating that the Maulam gets a 2% commission on all premium fabrics sold this week.
88. **Shift Handover:** Morning Maulam leaves, Evening Maulam arrives. They count the till and do a digital handover.
89. **Unauthorized Discount Attempt:** The system blocks an employee from applying a 100% discount.
90. **Audit Trail (Activity Log):** Manager checks the logs to see exactly who deleted a specific customer measurement.

## Category 10: Multi-Branch & Analytics
91. **Checking Other Branch Stock:** Maulam doesn't have a fabric, but uses the POS to see if Branch 2 has it.
92. **Daily Sales Dashboard:** Viewing total revenue, total orders, and average ticket size for the day.
93. **Bestselling Fabric Report:** Identifying which fabric to order more of next season.
94. **Tax Summary Report (ZATCA):** Generating the monthly VAT report for the accountant.
95. **Peak Hours Analysis:** Seeing that 70% of walk-ins happen between 8 PM and 11 PM to schedule staff accordingly.
96. **Customer Demographics:** Analyzing average age and spending power of the customer base.
97. **Inventory Valuation:** Calculating the total monetary value of all fabric rolls currently in the shop.
98. **Profit & Loss Estimate:** System subtracts fabric costs and logged expenses from revenue to show gross profit.
99. **End of Year Archiving:** System automatically archives orders older than 3 years to maintain performance, keeping only measurements active.
100. **The "Everything Goes Wrong" Scenario:** A VIP customer wants an urgent, BYOF order, pays with 3 payment methods, requires an external workshop alteration, the internet goes down, and they need a B2B tax invoice.

---

### Execution Protocol
As per the user's instructions:
> We will examine these scenarios ONE BY ONE in the app.
> We CANNOT move to Scenario 2 until Scenario 1 is completely fulfilled by the current application state.

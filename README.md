# YDelegate
Deposit | Withdraw | Delegate

This is the contract; https://etherscan.io/address/0x61025859c349dfbe6ef0dfca202ef3e84ca05f83#code


The steps are as follows;
Lets' say its the USDC vault
Then yDelegate.approval(USDC) returns address <- this is the address that the user will need to do credit Approval on
So if I do that, the result is; https://etherscan.io/address/0x619beb58998eD2278e08620f97007e1116D5D25b
Which is Aave variable debt bearing USDC
Then you need to approveDelegation(delegatee, amount)
Which is the same like token approval
so approveDelegation(0x61025859c349dFbE6eF0DfCa202ef3E84CA05f83, uint(-1))
0x61025859c349dFbE6eF0DfCa202ef3E84CA05f83 being the first contract
Now, you can deposit(USDC, amount)
And that's it
The inverse is withdraw(USDC, yUSDC_amount, maxLoss=1)
Which needs approval on yUSDC for that contract





Basically
Check Aave liquidity provided

Show users their amounts they can borrow and all that

Deposit borrowed assets into Yearn

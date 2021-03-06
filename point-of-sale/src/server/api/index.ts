import { createTransfer } from '@solana/pay';
import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { NextApiHandler } from 'next';
import { connection, FEE_PAYER, SECRET_KEYPAIR } from '../../server/core';
import { cors, rateLimit } from '../../server/middleware';
import { RECIPIENT, SPL_TOKEN } from '../../shared/constants';

export const handler: NextApiHandler<{ transaction: string }> = async function (request, response) {
    await cors(request, response);
    await rateLimit(request, response);

    /*
    Transfer request params provided in the URL by the app client. In practice, these should be generated on the server,
    persisted along with an unpredictable opaque ID representing the payment, and the ID be passed to the app client,
    which will include the ID in the transaction request URL. This prevents tampering with the transaction request.
    */
    const amountField = request.query.amount;
    if (!amountField) throw new Error('missing amount');
    if (typeof amountField !== 'string') throw new Error('invalid amount');
    const amount = new BigNumber(amountField);

    const referenceField = request.query.reference;
    if (!referenceField) throw new Error('missing reference');
    if (typeof referenceField !== 'string') throw new Error('invalid reference');
    const reference = new PublicKey(referenceField);

    // Account provided in the transaction request body by the wallet.
    const accountField = request.body?.account;
    if (!accountField) throw new Error('missing account');
    if (typeof accountField !== 'string') throw new Error('invalid account');
    const account = new PublicKey(accountField);

    // Compose a simple transfer transaction to return. In practice, this can be any transaction, and may be signed.
    const transaction = await createTransfer(connection, account, {
        recipient: RECIPIENT,
        amount,
        splToken: SPL_TOKEN,
        reference,
    });

    // Set the fee payer and sign the transaction as the fee payer
    // transaction.feePayer = FEE_PAYER;
    // transaction.partialSign(SECRET_KEYPAIR);

    // Serialize and return the unsigned transaction.
    const serialized = transaction.serialize({
        verifySignatures: false,
        requireAllSignatures: false,
    });
    const base64 = serialized.toString('base64');

    response.status(200).send({ transaction: base64 });
};

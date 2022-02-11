import { getAssociatedTokenAddress } from '@solana/spl-token';
import {
    Connection,
    Finality,
    LAMPORTS_PER_SOL,
    PublicKey,
    TransactionResponse,
    TransactionSignature,
} from '@solana/web3.js';
import BigNumber from 'bignumber.js';

/**
 * Thrown when a transaction doesn't contain a valid Solana Pay transfer.
 */
export class ValidateTransactionSignatureError extends Error {
    name = 'ValidateTransactionSignatureError';
}

/**
 * Validate that a given transaction signature corresponds with a transaction containing a valid Solana Pay transfer.
 *
 * @param connection - A connection to the cluster.
 * @param signature -  The signature to validate.
 * @param recipient - `recipient` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#recipient)
 * @param amount - `amount` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#amount)
 * @param splToken - `splToken` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#spl-token)
 * @param reference -`reference` in the [Solana Pay spec](https://github.com/solana-labs/solana-pay/blob/master/SPEC.md#reference)
 * @param {Finality} finality - A subset of Commitment levels, which are at least optimistically confirmed
 */
export async function validateTransactionSignature(
    connection: Connection,
    signature: TransactionSignature,
    recipient: PublicKey,
    amount: BigNumber,
    splToken?: PublicKey,
    reference?: PublicKey | PublicKey[],
    finality?: Finality
): Promise<TransactionResponse> {
    const response = await connection.getTransaction(signature, { commitment: finality });
    if (!response) throw new ValidateTransactionSignatureError('not found');
    if (!response.meta) throw new ValidateTransactionSignatureError('missing meta');
    if (response.meta.err) throw response.meta.err;

    let preAmount: BigNumber, postAmount: BigNumber;
    if (!splToken) {
        const accountIndex = response.transaction.message.accountKeys.findIndex((pubkey) => pubkey.equals(recipient));
        if (accountIndex === -1) throw new ValidateTransactionSignatureError('recipient not found');

        preAmount = new BigNumber(response.meta.preBalances[accountIndex]).div(LAMPORTS_PER_SOL);
        postAmount = new BigNumber(response.meta.postBalances[accountIndex]).div(LAMPORTS_PER_SOL);
    } else {
        const recipientATA = await getAssociatedTokenAddress(splToken, recipient);
        const accountIndex = response.transaction.message.accountKeys.findIndex((pubkey) =>
            pubkey.equals(recipientATA)
        );
        if (accountIndex === -1) throw new ValidateTransactionSignatureError('recipient not found');

        const preBalance = response.meta.preTokenBalances?.find((x) => x.accountIndex === accountIndex);
        const postBalance = response.meta.postTokenBalances?.find((x) => x.accountIndex === accountIndex);

        preAmount = new BigNumber(preBalance?.uiTokenAmount.uiAmountString || 0);
        postAmount = new BigNumber(postBalance?.uiTokenAmount.uiAmountString || 0);
    }

    if (postAmount.minus(preAmount).lt(amount)) throw new ValidateTransactionSignatureError('amount not transferred');

    if (reference) {
        if (!Array.isArray(reference)) {
            reference = [reference];
        }

        for (const pubkey of reference) {
            if (!response.transaction.message.accountKeys.some((accountKey) => accountKey.equals(pubkey)))
                throw new ValidateTransactionSignatureError('reference not found');
        }
    }

    return response;
}

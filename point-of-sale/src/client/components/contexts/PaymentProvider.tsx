import {
    encodeURL,
    fetchTransaction,
    findReference,
    FindReferenceError,
    parseURL,
    validateTransfer,
    ValidateTransferError,
} from '@solana/pay';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { ConfirmedSignatureInfo, Keypair, PublicKey, TransactionSignature } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { useRouter } from 'next/router';
import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { PaymentContext, PaymentStatus } from '../../hooks/usePayment';
import { Confirmations } from '../../types';

export interface PaymentProviderProps {
    children: ReactNode;
}

export const PaymentProvider: FC<PaymentProviderProps> = ({ children }) => {
    const { connection } = useConnection();
    const { link, recipient, splToken, label, requiredConfirmations, connectWallet } = useConfig();
    const { publicKey, sendTransaction } = useWallet();

    const [amount, setAmount] = useState<BigNumber>();
    const [message, setMessage] = useState<string>();
    const [reference, setReference] = useState<PublicKey>();
    const [signature, setSignature] = useState<TransactionSignature>();
    const [status, setStatus] = useState(PaymentStatus.New);
    const [confirmations, setConfirmations] = useState<Confirmations>(0);
    const router = useRouter();
    const progress = useMemo(() => confirmations / requiredConfirmations, [confirmations, requiredConfirmations]);

    const url = useMemo(() => {
        const url = new URL(String(link));

        if (amount) {
            url.searchParams.append('amount', amount.toFixed(amount.decimalPlaces()));
        }

        if (reference) {
            url.searchParams.append('reference', reference.toBase58());
        }

        return encodeURL({ link: url, label, message });
    }, [link, amount, reference, label, message]);

    const reset = useCallback(() => {
        setAmount(undefined);
        setMessage(undefined);
        setReference(undefined);
        setSignature(undefined);
        setStatus(PaymentStatus.New);
        setConfirmations(0);
        router.replace('/');
    }, [router]);

    const generate = useCallback(() => {
        if (status === PaymentStatus.New && !reference) {
            setReference(Keypair.generate().publicKey);
            setStatus(PaymentStatus.Pending);
            router.push('/pending');
        }
    }, [status, reference, router]);

    // If there's a connected wallet, use it to sign and send the transaction
    useEffect(() => {
        if (status === PaymentStatus.Pending && connectWallet && publicKey) {
            let changed = false;

            const run = async () => {
                try {
                    const request = parseURL(url);
                    if (!('link' in request)) return;

                    const transaction = await fetchTransaction(connection, publicKey, request.link);

                    if (!changed) {
                        await sendTransaction(transaction, connection);
                    }
                } catch (error) {
                    // If the transaction is declined or fails, try again
                    console.error(error);
                    timeout = setTimeout(run, 5000);
                }
            };
            let timeout = setTimeout(run, 0);

            return () => {
                changed = true;
                clearTimeout(timeout);
            };
        }
    }, [status, connectWallet, publicKey, url, connection, sendTransaction]);

    // When the status is pending, poll for the transaction using the reference key
    useEffect(() => {
        if (!(status === PaymentStatus.Pending && reference && !signature)) return;
        let changed = false;

        const interval = setInterval(async () => {
            let signature: ConfirmedSignatureInfo;
            try {
                signature = await findReference(connection, reference);

                if (!changed) {
                    clearInterval(interval);
                    setSignature(signature.signature);
                    setStatus(PaymentStatus.Confirmed);
                    router.replace('/confirmed');
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                // If the RPC node doesn't have the transaction signature yet, try again
                if (!(error instanceof FindReferenceError)) {
                    console.error(error);
                }
            }
        }, 250);

        return () => {
            changed = true;
            clearInterval(interval);
        };
    }, [status, reference, signature, connection, router]);

    // When the status is confirmed, validate the transaction against the provided params
    useEffect(() => {
        if (!(status === PaymentStatus.Confirmed && signature && amount)) return;
        let changed = false;

        const run = async () => {
            try {
                await validateTransfer(connection, signature, { recipient, amount, splToken, reference });

                if (!changed) {
                    setStatus(PaymentStatus.Valid);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                // If the RPC node doesn't have the transaction yet, try again
                if (
                    error instanceof ValidateTransferError &&
                    (error.message === 'not found' || error.message === 'missing meta')
                ) {
                    console.warn(error);
                    timeout = setTimeout(run, 250);
                    return;
                }

                console.error(error);
                setStatus(PaymentStatus.Invalid);
            }
        };
        let timeout = setTimeout(run, 0);

        return () => {
            changed = true;
            clearTimeout(timeout);
        };
    }, [status, signature, amount, connection, recipient, splToken, reference]);

    // When the status is valid, poll for confirmations until the transaction is finalized
    useEffect(() => {
        if (!(status === PaymentStatus.Valid && signature)) return;
        let changed = false;

        const interval = setInterval(async () => {
            try {
                const response = await connection.getSignatureStatus(signature);
                const status = response.value;
                if (!status) return;
                if (status.err) throw status.err;

                if (!changed) {
                    const confirmations = (status.confirmations || 0) as Confirmations;
                    setConfirmations(confirmations);

                    if (confirmations >= requiredConfirmations || status.confirmationStatus === 'finalized') {
                        clearInterval(interval);
                        setStatus(PaymentStatus.Finalized);
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                console.log(error);
            }
        }, 250);

        return () => {
            changed = true;
            clearInterval(interval);
        };
    }, [status, signature, connection, requiredConfirmations]);

    return (
        <PaymentContext.Provider
            value={{
                amount,
                setAmount,
                message,
                setMessage,
                reference,
                signature,
                status,
                confirmations,
                progress,
                url,
                reset,
                generate,
            }}
        >
            {children}
        </PaymentContext.Provider>
    );
};

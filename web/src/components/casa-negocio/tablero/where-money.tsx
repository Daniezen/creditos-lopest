import { cnTableroRecipes as r } from "@/design-system/recipes/casa-negocio";

import { formatMoney } from "../shared/format";
import type { AccountBalance } from "../types";

export interface WhereMoneyProps {
  /** The family's money: sum of every account (spec §3), computed by the engine. */
  total: number;
  accounts: AccountBalance[];
}

/**
 * «Dónde está la plata» (`Main.dc.html`): the family total, one bar split by
 * account, and each account with its balance and count status. Negative
 * balances take no width in the bar.
 */
export function WhereMoney({ total, accounts }: WhereMoneyProps) {
  const positive = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0);
  const share = (balance: number) => (positive > 0 ? Math.max(balance, 0) / positive : 0);
  const barLabel = accounts.map((account) => `${account.name} ${Math.round(share(account.balance) * 100)} %`).join(", ");

  return (
    <section aria-labelledby="cn-plata" className={[r.card, r.money].join(" ")}>
      <div className={r.moneyHead}>
        <h2 id="cn-plata" className={r.sectionTitle}>
          Dónde está la plata
        </h2>
        <span className={r.moneyTotal}>{formatMoney(total)}</span>
      </div>
      {/* With nothing positive to split, an empty track keeps the bar's place. */}
      <div role="img" aria-label={barLabel} className={[r.moneyBar, positive > 0 ? "" : r.moneyBarEmpty].join(" ")}>
        {accounts.map((account) => (
          <span
            key={account.id}
            className={[r.moneySegment, r.swatch[account.swatch]].join(" ")}
            style={{ flexGrow: Math.round(share(account.balance) * 10000) }}
          />
        ))}
      </div>
      <ul className={r.moneyGrid}>
        {accounts.map((account) => (
          <li key={account.id} className={r.account}>
            <span aria-hidden="true" className={[r.accountSwatch, r.swatch[account.swatch]].join(" ")} />
            <div>
              <div className={r.accountName}>{account.name}</div>
              <div className={r.accountBalance}>{formatMoney(account.balance)}</div>
              <div className={r.accountStatus[account.status.tone]}>{account.status.text}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

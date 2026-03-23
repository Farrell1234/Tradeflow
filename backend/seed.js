const db = require('./src/db');

async function run() {
  const { rows: algos } = await db.query('SELECT * FROM algos LIMIT 1');
  if (!algos[0]) { console.log('No algos found'); process.exit(1); }
  const algo = algos[0];
  console.log('Algo:', algo.name, '| webhook_id:', algo.webhook_id);

  const { rows: existing } = await db.query('SELECT * FROM order_sets WHERE algo_id = $1', [algo.id]);
  if (existing.length > 0) {
    console.log('Order sets already exist:', existing.length);
    process.exit(0);
  }

  await db.query(
    `INSERT INTO order_sets (algo_id, name, contracts, entry_type, profit_target_ticks, stop_type, stop_ticks)
     VALUES ($1, 'Default scalp', 1, 'market', 20, 'fixed', 20)`,
    [algo.id]
  );
  console.log('Default order set added — ready to fire signals!');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });

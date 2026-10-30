import logging
from django.core.management.base import BaseCommand
from vasps.models import VASP, VASPAddress

logger = logging.getLogger('vasps')


class Command(BaseCommand):
    help = 'Seeds verified real-world VASP entities and known public cluster addresses into the database.'

    def handle(self, *args, **options):
        self.stdout.write("Seeding verified public VASP intelligence into database...")

        vasp_catalog = [
            {
                'name': 'Binance',
                'jurisdiction': 'Global / Cayman Islands',
                'website': 'https://binance.com',
                'description': 'Global centralized cryptocurrency exchange and custody provider.',
                'addresses': [
                    {'address': '0x28c6c06298d514db089934071355e5743bf21d60', 'type': 'hot_wallet', 'label': 'Binance 14 (Hot Wallet)'},
                    {'address': '0x21a31ee1afc51d94c2efccaa2092ad1028285549', 'type': 'hot_wallet', 'label': 'Binance 15 (Hot Wallet)'},
                    {'address': '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', 'type': 'hot_wallet', 'label': 'Binance 16 (Hot Wallet)'},
                    {'address': '0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be', 'type': 'hot_wallet', 'label': 'Binance Hot Wallet'},
                    {'address': '0xf977814e90da44bfa03b6295a0616a897441acec', 'type': 'hot_wallet', 'label': 'Binance 8 (Hot Wallet)'},
                    {'address': '0xd551234ae421e3bcba99a0da6d736074f22192ff', 'type': 'hot_wallet', 'label': 'Binance 1'},
                    {'address': '0x564286362092d8e7936f0549571a803b203aaced', 'type': 'hot_wallet', 'label': 'Binance 2'},
                ]
            },
            {
                'name': 'Coinbase',
                'jurisdiction': 'United States',
                'website': 'https://coinbase.com',
                'description': 'US regulated digital asset exchange and institutional custodian.',
                'addresses': [
                    {'address': '0x503828976d22510aad0201ac7ec88293211d23da', 'type': 'hot_wallet', 'label': 'Coinbase 1 (Hot Wallet)'},
                    {'address': '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', 'type': 'hot_wallet', 'label': 'Coinbase 2 (Hot Wallet)'},
                    {'address': '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740', 'type': 'hot_wallet', 'label': 'Coinbase 3 (Hot Wallet)'},
                    {'address': '0xa090e606e30bd747d4e6245a1517ebe430f0057e', 'type': 'hot_wallet', 'label': 'Coinbase 4 (Hot Wallet)'},
                ]
            },
            {
                'name': 'Kraken',
                'jurisdiction': 'United States',
                'website': 'https://kraken.com',
                'description': 'Cryptocurrency exchange and digital banking institution.',
                'addresses': [
                    {'address': '0x2910543af39aba0cd09dbb2d50200b3e800a63d2', 'type': 'hot_wallet', 'label': 'Kraken 1 (Hot Wallet)'},
                    {'address': '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13', 'type': 'hot_wallet', 'label': 'Kraken 2 (Hot Wallet)'},
                    {'address': '0xe853c56e1cc02d9a53d6041107d51e4467653698', 'type': 'hot_wallet', 'label': 'Kraken 3 (Hot Wallet)'},
                ]
            },
            {
                'name': 'OKX',
                'jurisdiction': 'Seychelles',
                'website': 'https://okx.com',
                'description': 'Global digital asset exchange platform and custody provider.',
                'addresses': [
                    {'address': '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b', 'type': 'hot_wallet', 'label': 'OKX 1 (Hot Wallet)'},
                    {'address': '0xa7efae728d2936e78bda97dc267687568dd593f3', 'type': 'hot_wallet', 'label': 'OKX 2 (Hot Wallet)'},
                ]
            },
            {
                'name': 'Bitfinex',
                'jurisdiction': 'British Virgin Islands',
                'website': 'https://bitfinex.com',
                'description': 'Centralized cryptocurrency trading exchange.',
                'addresses': [
                    {'address': '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa', 'type': 'hot_wallet', 'label': 'Bitfinex 1'},
                    {'address': '0x1151314c646ace4e0045781a57c2657576552e69', 'type': 'hot_wallet', 'label': 'Bitfinex 2'},
                ]
            },
        ]

        created_vasps = 0
        created_addrs = 0

        for item in vasp_catalog:
            vasp, created = VASP.objects.get_or_create(
                name=item['name'],
                defaults={
                    'jurisdiction': item.get('jurisdiction', ''),
                    'website': item.get('website', ''),
                    'description': item.get('description', ''),
                    'status': 'ACTIVE',
                    'source': 'Verified Public Exchange Registry'
                }
            )
            if created:
                created_vasps += 1

            for addr_info in item['addresses']:
                addr_clean = addr_info['address'].lower().strip()
                _, a_created = VASPAddress.objects.get_or_create(
                    address=addr_clean,
                    blockchain='ethereum',
                    defaults={
                        'vasp': vasp,
                        'address_type': addr_info.get('type', 'hot_wallet'),
                        'label': addr_info.get('label', ''),
                        'source': 'Etherscan / Public Cluster Intelligence',
                        'confidence': 1.0
                    }
                )
                if a_created:
                    created_addrs += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded VASP intelligence: {created_vasps} new VASPs, {created_addrs} new addresses. "
                f"Total in database: {VASP.objects.count()} VASPs, {VASPAddress.objects.count()} addresses."
            )
        )

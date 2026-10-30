from django.test import TestCase
from django.utils import timezone
from decimal import Decimal

from transactions.models import Transaction
from graph.builder import GraphBuilder


class GraphConstructionTestCase(TestCase):
    def test_networkx_graph_construction(self):
        subject = "0x1111111111111111111111111111111111111111"
        peer_a = "0x2222222222222222222222222222222222222222"
        peer_b = "0x3333333333333333333333333333333333333333"

        tx1 = Transaction.objects.create(
            tx_hash="0xghash1",
            blockchain='ethereum',
            sender=subject,
            receiver=peer_a,
            amount=Decimal('1.0'),
            timestamp=timezone.now()
        )
        tx2 = Transaction.objects.create(
            tx_hash="0xghash2",
            blockchain='ethereum',
            sender=peer_a,
            receiver=peer_b,
            amount=Decimal('0.8'),
            timestamp=timezone.now()
        )

        G = GraphBuilder.build_networkx_graph(
            subject_address=subject,
            transactions=[tx1, tx2],
            max_depth=2,
            blockchain='ethereum'
        )

        self.assertEqual(len(G.nodes()), 3)
        self.assertEqual(len(G.edges()), 2)
        self.assertEqual(G.nodes[subject]['type'], 'target')

        elements = GraphBuilder.export_cytoscape_elements(G, max_depth=2)
        self.assertIn('nodes', elements)
        self.assertIn('edges', elements)
        self.assertEqual(len(elements['nodes']), 3)
        self.assertEqual(len(elements['edges']), 2)

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Create an initial superuser administrator for the VASPMap platform if not already exists.'

    def add_arguments(self, parser):
        parser.add_argument('--username', type=str, default='admin', help='Admin username')
        parser.add_argument('--password', type=str, default='admin1234', help='Admin password')
        parser.add_argument('--email', type=str, default='admin@vaspmap.local', help='Admin email')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        email = options['email']

        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f"User '{username}' already exists."))
            return

        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(f"Superuser '{username}' successfully created."))

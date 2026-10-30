import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from both backend and project-root .env files.
# This keeps Windows project setup flexible while preventing accidental secret leaks.
for env_path in (BASE_DIR / '.env', BASE_DIR.parent / '.env'):
    if env_path.exists():
        load_dotenv(env_path, override=False)

SECRET_KEY = os.environ.get(
    'SECRET_KEY',
    'django-insecure-vaspmap-forensics-production-key-change-in-prod'
)

DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
    if host.strip()
]
if 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',

    # Project apps
    'common.apps.CommonConfig',
    'accounts.apps.AccountsConfig',
    'wallets.apps.WalletsConfig',
    'transactions.apps.TransactionsConfig',
    'vasps.apps.VaspsConfig',
    'blockchain.apps.BlockchainConfig',
    'analysis.apps.AnalysisConfig',
    'graph.apps.GraphConfig',
    'investigations.apps.InvestigationsConfig',
    'reports.apps.ReportsConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
    'DEFAULT_PAGINATION_CLASS': 'common.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 15,
    'EXCEPTION_HANDLER': 'common.exceptions.custom_exception_handler',
}

# Simple JWT Configuration
JWT_MINUTES = int(os.environ.get('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60))
JWT_DAYS = int(os.environ.get('JWT_REFRESH_TOKEN_LIFETIME_DAYS', 7))

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=JWT_MINUTES),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=JWT_DAYS),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer', 'Token'),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# CORS Configuration
raw_cors = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173'
)
CORS_ALLOWED_ORIGINS = [origin.strip() for origin in raw_cors.split(',') if origin.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Blockchain Configuration (Alchemy & multi-provider support)
BLOCKCHAIN_PROVIDER = os.environ.get('BLOCKCHAIN_PROVIDER', 'alchemy').strip().lower()

# Alchemy API Settings
ALCHEMY_API_KEY = os.environ.get('ALCHEMY_API_KEY', '').strip()
ALCHEMY_NETWORK = os.environ.get('ALCHEMY_NETWORK', 'eth-mainnet').strip().lower()

# Fallback Generic / Legacy Etherscan Settings
BLOCKCHAIN_API_KEY = os.environ.get('BLOCKCHAIN_API_KEY', '')
BLOCKCHAIN_API_URL = os.environ.get('BLOCKCHAIN_API_URL', 'https://api.etherscan.io/api')

# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} [{name}:{lineno}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'blockchain': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'investigations': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'analysis': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

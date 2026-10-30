import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler providing consistent, clean error structures:
    {
        "success": false,
        "error": {
            "code": "...",
            "message": "...",
            "details": {...}
        }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_code = 'API_ERROR'
        error_message = 'An unexpected API error occurred.'

        if response.status_code == 400:
            error_code = 'VALIDATION_ERROR'
            error_message = 'Invalid request parameters or payload.'
        elif response.status_code == 401:
            error_code = 'UNAUTHORIZED'
            error_message = 'Authentication credentials were not provided or have expired.'
        elif response.status_code == 403:
            error_code = 'FORBIDDEN'
            error_message = 'You do not have permission to perform this action.'
        elif response.status_code == 404:
            error_code = 'NOT_FOUND'
            error_message = 'The requested resource was not found.'
        elif response.status_code >= 500:
            error_code = 'SERVER_ERROR'
            error_message = 'An internal server error occurred in the analysis engine.'

        # Extract message from detail or data if available
        if isinstance(response.data, dict):
            if 'detail' in response.data:
                error_message = str(response.data['detail'])
            elif 'message' in response.data:
                error_message = str(response.data['message'])

        custom_data = {
            'success': False,
            'error': {
                'code': error_code,
                'message': error_message,
                'details': response.data if isinstance(response.data, dict) and 'detail' not in response.data else None,
            }
        }

        # Also copy detail and field-level error keys to top-level for client convenience
        if isinstance(response.data, dict):
            for k, v in response.data.items():
                if k not in custom_data:
                    custom_data[k] = v

        response.data = custom_data
    else:
        # Unhandled server exception
        view_name = context.get('view', 'UnknownView')
        logger.exception(f'Unhandled exception in view {view_name}: {exc}')
        response = Response(
            {
                'success': False,
                'error': {
                    'code': 'INTERNAL_SERVER_ERROR',
                    'message': 'An internal server error occurred while processing the blockchain request.',
                    'details': str(exc) if hasattr(exc, 'message') else None,
                },
                'detail': str(exc) if hasattr(exc, 'message') else 'Internal server error',
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response

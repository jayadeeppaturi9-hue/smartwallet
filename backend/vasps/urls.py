from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import VASPViewSet, VASPAddressViewSet, VASPAttributionListView

router = DefaultRouter()
router.register(r'addresses', VASPAddressViewSet, basename='vasp-address')
router.register(r'', VASPViewSet, basename='vasp')

urlpatterns = [
    path('attributions/', VASPAttributionListView.as_view(), name='vasp_attributions'),
    path('<int:vasp_pk>/addresses/', VASPAddressViewSet.as_view({'get': 'list', 'post': 'create'}), name='vasp_nested_addresses'),
    path('', include(router.urls)),
]

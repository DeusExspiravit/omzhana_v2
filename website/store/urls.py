from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('about/', views.about, name='about'),
    path('base/', views.base, name='base'),
    path('cart/', views.cart, name='cart'),
    path('shop/', views.shop, name='shop'),
]

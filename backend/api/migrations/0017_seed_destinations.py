from django.db import migrations
from django.db.models import Q


DESTINATIONS = [
    {
        'name': 'Maasai Mara National Reserve',
        'slug': 'maasai-mara-national-reserve',
        'category': 'iconic_safaris',
        'badge': 'Most Popular',
        'duration': '3 Days / 2 Nights',
        'hook': 'Witness the Big Five across the endless golden savannahs of the Maasai Mara.',
        'highlights': ['Sunrise game drives', 'Hot air balloon safaris', 'Maasai village cultural visits'],
        'cta_label': 'Explore Mara Packages',
        'images': [],
        'featured_on_home': True,
        'sort_order': 1,
        'package_terms': ['Maasai Mara', 'Mara'],
    },
    {
        'name': 'Serengeti Great Migration',
        'slug': 'serengeti-great-migration',
        'category': 'iconic_safaris',
        'badge': 'Great Migration',
        'duration': '',
        'hook': 'Witness vast wildebeest herds moving across Tanzania’s Serengeti in one of nature’s greatest wildlife spectacles.',
        'highlights': ['Seasonal migration viewing', 'Serengeti game drives', 'Open-savannah landscapes'],
        'cta_label': 'Explore Serengeti Packages',
        'images': [],
        'featured_on_home': True,
        'sort_order': 14,
        'package_terms': ['Serengeti', 'Great Migration'],
    },
    {
        'name': 'Amboseli National Park',
        'slug': 'amboseli-national-park',
        'category': 'iconic_safaris',
        'badge': 'Best Views',
        'duration': '2 or 3 Days',
        'hook': 'Photograph massive elephant herds walking directly beneath the snow-capped peak of Mount Kilimanjaro.',
        'highlights': ['Observation Hill panoramas', 'Swamp wildlife viewing', 'Luxury tented camps'],
        'cta_label': 'Explore Amboseli Packages',
        'images': ['/images/amboseli.jpg'],
        'featured_on_home': True,
        'sort_order': 2,
        'package_terms': ['Amboseli'],
    },
    {
        'name': 'Ol Pejeta Conservancy (Nanyuki)',
        'slug': 'ol-pejeta-conservancy-nanyuki',
        'category': 'iconic_safaris',
        'badge': 'Conservation Special',
        'duration': '2 Days',
        'hook': 'Get up close with endangered wildlife at the foothills of Mount Kenya.',
        'highlights': ['Last two northern white rhinos', 'Sweetwaters Chimpanzee Sanctuary', 'Night game drives'],
        'cta_label': 'Explore Ol Pejeta Packages',
        'images': ['/images/background.jpg'],
        'sort_order': 3,
        'package_terms': ['Ol Pejeta', 'Sweetwaters'],
    },
    {
        'name': 'Samburu National Reserve',
        'slug': 'samburu-national-reserve',
        'category': 'iconic_safaris',
        'badge': 'Untamed North',
        'duration': '3 Days',
        'hook': 'Discover rugged desert landscapes and rare wildlife found nowhere else in northern Kenya.',
        'highlights': ['The Samburu Special Five', 'Ewaso Nyiro riverbanks', 'Samburu cultural encounters'],
        'cta_label': 'Explore Samburu Packages',
        'images': ['/images/greatmigration.jpg'],
        'sort_order': 4,
        'package_terms': ['Samburu'],
    },
    {
        'name': 'Diani Beach (South Coast)',
        'slug': 'diani-beach-south-coast',
        'category': 'beach_coastal_escapes',
        'badge': 'Top Beach Getaway',
        'duration': '3–5 Days (SGR or Flight)',
        'hook': 'Sink your toes into powder-white sands framed by turquoise waters and lush coastal forests.',
        'highlights': ['Wasini Island dolphin tours', 'Kisite Marine Park snorkeling', 'Oceanfront skydiving'],
        'cta_label': 'Explore Diani Packages',
        'images': ['/images/diani.jpg'],
        'featured_on_home': True,
        'sort_order': 5,
        'package_terms': ['Diani'],
    },
    {
        'name': 'Mambrui Sand Dunes & Malindi',
        'slug': 'mambrui-sand-dunes-malindi',
        'category': 'beach_coastal_escapes',
        'badge': 'Viral Photo Spot',
        'duration': '3–4 Days',
        'hook': 'Experience the surreal beauty of golden desert dunes meeting the Indian Ocean.',
        'highlights': ['Sunset dune walks', 'Marafa Hell’s Kitchen canyon tour', 'Vasco da Gama Pillar'],
        'cta_label': 'Explore Mambrui & Malindi',
        'images': ['/images/diani.jpg'],
        'sort_order': 6,
        'package_terms': ['Mambrui', 'Malindi'],
    },
    {
        'name': 'Watamu & Mida Creek',
        'slug': 'watamu-mida-creek',
        'category': 'beach_coastal_escapes',
        'badge': 'Marine Paradise',
        'duration': '3–4 Days',
        'hook': 'Dive into crystal-clear coral gardens and unwind in tranquil coastal lagoons.',
        'highlights': ['Glass-bottom boat rides', 'Sunset boardwalks at Mida Creek', 'Gede Ruins'],
        'cta_label': 'Explore Watamu Packages',
        'images': ['/images/diani.jpg'],
        'sort_order': 7,
        'package_terms': ['Watamu', 'Mida Creek'],
    },
    {
        'name': 'Lamu Island',
        'slug': 'lamu-island',
        'category': 'beach_coastal_escapes',
        'badge': 'Cultural Escape',
        'duration': '3–5 Days (Fly-In)',
        'hook': 'Step back in time on a car-free island defined by centuries-old Swahili architecture and serene beaches.',
        'highlights': ['Traditional sunset dhow cruises', 'Shela Beach relaxation', 'Lamu Old Town tours'],
        'cta_label': 'Explore Lamu Packages',
        'images': ['/images/diani.jpg'],
        'sort_order': 8,
        'package_terms': ['Lamu'],
    },
    {
        'name': 'Lake Elementaita',
        'slug': 'lake-elementaita',
        'category': 'rift_valley_weekenders',
        'badge': 'Romantic & Scenic',
        'duration': '1–2 Days',
        'hook': 'Unwind beside shimmering alkaline waters framed by flamingos and the iconic Sleeping Warrior hill.',
        'highlights': ['Kekopey natural hot springs', 'Lakeside luxury glamping', 'Birdwatching walks'],
        'cta_label': 'Explore Elementaita',
        'images': ['/images/lakenakuru.jpg'],
        'sort_order': 9,
        'package_terms': ['Elementaita'],
    },
    {
        'name': 'Lake Naivasha & Hell’s Gate',
        'slug': 'lake-naivasha-hells-gate',
        'category': 'rift_valley_weekenders',
        'badge': 'Adventure Favorite',
        'duration': 'Day Trip or Weekend',
        'hook': 'Cycle alongside zebras and giraffes before taking a sunset boat ride past pods of hippos.',
        'highlights': ['Hell’s Gate gorge hikes', 'Crescent Island walking safari', 'Lakeside boat cruises'],
        'cta_label': 'Explore Naivasha',
        'images': ['/images/lakenakuru.jpg'],
        'sort_order': 10,
        'package_terms': ['Naivasha', 'Hell’s Gate'],
    },
    {
        'name': 'Lake Nakuru National Park',
        'slug': 'lake-nakuru-national-park',
        'category': 'rift_valley_weekenders',
        'badge': 'Quick Safari',
        'duration': '1–2 Days',
        'hook': 'Spot black and white rhinos, tree-climbing lions, and sweeping cliffside lake views just hours from Nairobi.',
        'highlights': ['Baboon Cliff viewpoint', 'Makalia Falls', 'Dense rhino sanctuary'],
        'cta_label': 'Explore Lake Nakuru',
        'images': ['/images/lakenakuru.jpg'],
        'sort_order': 11,
        'package_terms': ['Lake Nakuru', 'Nakuru'],
    },
    {
        'name': 'Lake Bogoria & Lake Baringo',
        'slug': 'lake-bogoria-lake-baringo',
        'category': 'hidden_gems_road_trips',
        'badge': 'Road Trip Special',
        'duration': '2–3 Days',
        'hook': 'Witness steaming geothermal geysers and massive pink flamingo flocks in the northern Rift Valley.',
        'highlights': ['Boiling hot springs', 'Baringo fish-eagle boat tours', 'Island retreats'],
        'cta_label': 'Explore Bogoria & Baringo',
        'images': ['/images/lakenakuru.jpg'],
        'sort_order': 12,
        'package_terms': ['Bogoria', 'Baringo'],
    },
    {
        'name': 'Chyulu Hills & Tsavo West',
        'slug': 'chyulu-hills-tsavo-west',
        'category': 'hidden_gems_road_trips',
        'badge': 'Off-The-Beaten-Path',
        'duration': '3 Days',
        'hook': 'Ride horseback across emerald volcanic hills overlooking Mount Kilimanjaro and ancient lava flows.',
        'highlights': ['Mzima Springs underwater hippo viewing', 'Shetani Lava Flows', 'Scenic hiking'],
        'cta_label': 'Explore Chyulu & Tsavo',
        'images': ['/images/amboseli.jpg'],
        'sort_order': 13,
        'package_terms': ['Chyulu', 'Tsavo West'],
    },
]


def seed_destinations(apps, schema_editor):
    Destination = apps.get_model('api', 'Destination')
    Safari = apps.get_model('api', 'Safari')

    for data in DESTINATIONS:
        destination_data = {key: value for key, value in data.items() if key != 'package_terms'}
        destination, _ = Destination.objects.update_or_create(
            slug=data['slug'],
            defaults=destination_data,
        )
        matching_packages = Safari.objects.none()
        for term in data['package_terms']:
            matching_packages = matching_packages | Safari.objects.filter(
                Q(title__icontains=term) | Q(location__icontains=term)
            )
        destination.safaris.set(matching_packages.distinct())


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_destination'),
    ]

    operations = [
        migrations.RunPython(seed_destinations, migrations.RunPython.noop),
    ]

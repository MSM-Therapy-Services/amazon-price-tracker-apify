import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
const { productUrls = [], maxItems = 10 } = input;

console.log('🚀 Starting Amazon Price Tracker...');
console.log(`📦 Processing ${productUrls.length} product URLs`);
console.log(`🎯 Max items limit: ${maxItems}`);

if (!productUrls.length) {
    throw new Error('❌ Please provide at least one Amazon product URL');
}

const crawler = new PuppeteerCrawler({
    maxRequestsPerCrawl: maxItems,
    requestHandler: async ({ request, page }) => {
        const url = request.url;
        console.log(`🔍 Scraping: ${url}`);
        
        try {
            // Wait for page to load
            await page.waitForLoadState('networkidle');
            
            // Extract product data
            const productData = await page.evaluate(() => {
                // Get product title
                const titleSelectors = [
                    '#productTitle',
                    'h1.a-size-large',
                    '.product-title',
                    'h1'
                ];
                
                let title = 'Title not found';
                for (const selector of titleSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        title = element.textContent.trim();
                        break;
                    }
                }
                
                // Get price - Amazon has multiple possible price selectors
                const priceSelectors = [
                    '.a-price .a-offscreen',
                    '.a-price-whole',
                    '#priceblock_dealprice',
                    '#priceblock_ourprice',
                    '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
                    '.a-price-range .a-offscreen',
                    '.a-price.a-text-price .a-offscreen'
                ];
                
                let price = 'Price not found';
                for (const selector of priceSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        price = element.textContent.trim();
                        break;
                    }
                }
                
                // Get image
                const imageSelectors = [
                    '#landingImage',
                    '.a-dynamic-image',
                    '#imgTagWrapperId img',
                    '.a-button-thumbnail img'
                ];
                
                let imageUrl = null;
                for (const selector of imageSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.src) {
                        imageUrl = element.src;
                        break;
                    }
                }
                
                // Get rating
                const ratingSelectors = [
                    '.a-icon-alt',
                    '[data-hook="rating-out-of-text"]',
                    '.cr-original-review-link'
                ];
                
                let rating = 'No rating available';
                for (const selector of ratingSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        rating = element.textContent.trim();
                        break;
                    }
                }
                
                return {
                    title,
                    price,
                    imageUrl,
                    rating,
                    scrapedAt: new Date().toISOString()
                };
            });
            
            // Add URL to the data
            productData.url = url;
            
            // Save to dataset
            await Actor.pushData(productData);
            
            console.log(`✅ Successfully scraped: ${productData.title}`);
            console.log(`💰 Price: ${productData.price}`);
            console.log(`⭐ Rating: ${productData.rating}`);
            
        } catch (error) {
            console.error(`❌ Error scraping ${url}:`, error.message);
            await Actor.pushData({
                url,
                title: 'Error occurred',
                price: 'Could not retrieve',
                error: error.message,
                scrapedAt: new Date().toISOString()
            });
        }
    },
});

// Add URLs to the queue
console.log('📋 Adding URLs to processing queue...');
for (const url of productUrls.slice(0, maxItems)) {
    await crawler.addRequests([{ url }]);
}

// Run the crawler
console.log('🎬 Starting the scraping process...');
await crawler.run();

console.log('🎉 Amazon price tracking completed successfully!');
await Actor.exit();
